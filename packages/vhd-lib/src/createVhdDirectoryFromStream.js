import { VhdDirectory } from './'
import { BLOCK_UNUSED, FOOTER_SIZE, HEADER_SIZE, SECTOR_SIZE } from './_constants'
import { readChunk } from '@vates/read-chunk'
import assert from 'assert'
import { Disposable } from 'promise-toolbox'
import { buildFooter, buildHeader } from './Vhd/_utils'
import { asyncEach } from '@vates/async-each'

const cappedBufferConcat = (buffers, maxSize) => {
  let buffer = Buffer.concat(buffers)
  if (buffer.length > maxSize) {
    buffer = buffer.slice(buffer.length - maxSize)
  }
  return buffer
}

async function* parse(stream) {
  let bytesRead = 0

  // handle empty space between elements
  // ensure we read stream in order
  async function read(offset, size) {
    assert(bytesRead <= offset)
    if (bytesRead < offset) {
      // empty spaces
      await read(bytesRead, offset - bytesRead)
    }
    const buf = await readChunk(stream, size)
    assert(buf.length === size, `read ${buf.length} instead of ${size}`)
    bytesRead += size
    return buf
  }

  const bufFooter = await read(0, FOOTER_SIZE)

  const footer = buildFooter(bufFooter)
  yield { type: 'footer', footer, offset: 0 }

  const bufHeader = await read(FOOTER_SIZE, HEADER_SIZE)
  const header = buildHeader(bufHeader, footer)

  yield { type: 'header', header, offset: SECTOR_SIZE }

  const blockBitmapSize = Math.ceil(header.blockSize / SECTOR_SIZE / 8 / SECTOR_SIZE) * SECTOR_SIZE
  const blockSize = header.blockSize
  const blockAndBitmapSize = blockBitmapSize + blockSize

  const batOffset = header.tableOffset
  const batSize = Math.max(1, Math.ceil((header.maxTableEntries * 4) / SECTOR_SIZE)) * SECTOR_SIZE
  /**
   * the norm allows the BAT to be after some blocks or parent locator
   * we do not handle this case for now since we need the BAT to order the blocks/parent locator
   *
   * also there can be some free space between header and the start of BAT
   */

  const bat = await read(batOffset, batSize)

  /**
   * the norm allows blocks and parent locators  to be intervined
   *
   * we build a sorted index since we read the stream sequentially and
   * we need to know what is the the next element to read and its size
   * (parent locator size can vary)
   */

  const index = []
  for (let blockCounter = 0; blockCounter < header.maxTableEntries; blockCounter++) {
    const batEntrySector = bat.readUInt32BE(blockCounter * 4)
    // unallocated block, no need to export it
    if (batEntrySector === BLOCK_UNUSED) {
      continue
    }
    const batEntryBytes = batEntrySector * SECTOR_SIZE
    // ensure the block is not before the bat
    assert.ok(batEntryBytes >= batOffset + batSize)
    index.push({
      type: 'block',
      id: blockCounter,
      offset: batEntryBytes,
      size: blockAndBitmapSize,
    })
  }

  for (const parentLocatorId in header.parentLocatorEntry) {
    const parentLocatorEntry = header.parentLocatorEntry[parentLocatorId]
    // empty parent locator entry, does not exist in the content
    if (parentLocatorEntry.platformDataSpace === 0) {
      continue
    }
    assert.ok(parentLocatorEntry.platformDataOffset * SECTOR_SIZE >= batOffset + batSize)

    index.push({
      type: 'parentLocator',
      offset: parentLocatorEntry.platformDataOffset * SECTOR_SIZE,
      size: parentLocatorEntry.platformDataSpace * SECTOR_SIZE,
      id: parentLocatorId,
    })
  }

  index.sort((a, b) => a.offset - b.offset)

  for (const item of index) {
    const buffer = await read(item.offset, item.size)
    yield { ...item, buffer }
  }
  /**
   * the second footer is at filesize - 512 , there can be empty spaces between last block
   * and the start of the footer
   *
   * we read till the end of the stream, and use the last 512 bytes as the footer
   */
  const bufFooterEnd = await readLastSector()
  assert(bufFooter.equals(bufFooterEnd), 'footer1 !== footer2')
}

function readLastSector(stream) {
  return new Promise(resolve => {
    let bufFooterEnd = Buffer.alloc(0)
    stream.on('data', chunk => {
      if (chunk) {
        bufFooterEnd = cappedBufferConcat([bufFooterEnd, chunk], SECTOR_SIZE)
      }
    })

    stream.on('end', chunk => {
      if (chunk) {
        bufFooterEnd = cappedBufferConcat([bufFooterEnd, chunk], SECTOR_SIZE)
      }
      resolve(bufFooterEnd)
    })
  })
}

export async function createVhdDirectoryFromStream(handler, path, inputStream) {
  return await Disposable.use(async function* () {
    const vhd = yield VhdDirectory.create(handler, path)
    await asyncEach(
      parse(inputStream),
      async function (item) {
        switch (item.type) {
          case 'footer':
            vhd.footer = item.footer
            break
          case 'header':
            vhd.header = item.header
            break
          case 'parentLocator':
            await vhd.writeParentLocator({ ...item, data: item.buffer })
            break
          case 'block':
            await vhd.writeEntireBlock(item)
            break
          default:
            throw new Error(`unhandled type of block generated by parser : ${item.type} while generating ${path}`)
        }
      },
      {
        concurrency: 10,
      }
    )

    await Promise.all([vhd.writeFooter(), vhd.writeHeader(), vhd.writeBlockAllocationTable()])
  })
}
