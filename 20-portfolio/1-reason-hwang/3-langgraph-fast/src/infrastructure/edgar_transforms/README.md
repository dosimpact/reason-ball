# SEC Inline Transforms (vendored upstream)

Unmodified runtime subset of the official [Arelle/EDGAR](https://github.com/Arelle/EDGAR) SEC transformation plugin, pinned at commit `4891c4c9889c77af247428ceff4fa7cc52d534ea`.

- `__init__.py`: upstream `transform/__init__.py` (plugin version 19.2).
- `text2num.py`: upstream `transform/text2num.py`.
- `LICENSE`: upstream repository CC0 license. SEC government work notice and plugin Apache-2 metadata are retained in `__init__.py`; the embedded text2num MIT license is retained in `text2num.py`.
- Upstream's header refers to `COPYRIGHT.md`, but that file is absent at the pinned commit; no license text has been invented or removed.

Arelle's pip package excludes EDGAR plugins. [Arelle documentation](https://arelle.readthedocs.io/en/latest/plugins/popular/transforms_sec.html) identifies this plugin as the official SEC Inline XBRL transform implementation. This subset supplies the `ixt-sec` transforms to the model-3 parser without installing the unrelated PyPI package named edgar-renderer. Keep these vendored Python files unchanged; put project integration in the caller.

To update, review the upstream commit, replace both runtime files and license together, update this pin, and run the SEC transform and real-filing model-3 tests. The existing pinned `arelle-release` dependency supplies the compatible API and `regex` dependency.
