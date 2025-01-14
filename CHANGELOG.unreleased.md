> This file contains all changes that have not been released yet.
>
> Keep in mind the changelog is addressed to **users** and should be
> understandable by them.

### Enhancements

> Users must be able to say: “Nice enhancement, I'm eager to test it”

- [Backup/logs] identify XAPI errors (PR [#6001](https://github.com/vatesfr/xen-orchestra/pull/6001))

### Bug fixes

> Users must be able to say: “I had this issue, happy to know it's fixed”

[Import/VM] Fix the import of OVA files (PR [#5976](https://github.com/vatesfr/xen-orchestra/pull/5976))

### Packages to release

> Packages will be released in the order they are here, therefore, they should
> be listed by inverse order of dependency.
>
> Rule of thumb: add packages on top.
>
> The format is the following: - `$packageName` `$version`
>
> Where `$version` is
>
> - patch: if the change is a bug fix or a simple code improvement
> - minor: if the change is a new feature
> - major: if the change breaks compatibility
>
> In case of conflict, the highest (lowest in previous list) `$version` wins.

- @vates/async-each minor
- @xen-orchestra/fs minor
- vhd-lib major
- @xen-orchestra/backups minor
- xo-lib patch
- xo-server patch
- vhd-cli minor
- xo-web minor
