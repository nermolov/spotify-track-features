* tree style tab as primary interface

* can convert a given window/tree to be "persisted"
* updates/changes are auto-saved
* can have text notes as entries in the tree tab

* persisted trees have a title and tags
* browser/tag based search for persisted trees

storage should be file-based, with compatibility for syncing software like syncthing, dropbox/gdrive, etc...

## implem steps

* saving/loading trees
* saving/loading tree data as files
* adding text note tabs
* indexing saved files by tags
* searching tagged files

## implem

* typescript + svelte? webextension that
  * communicates with native program to persist trees
  * gets called by native program to open trees
  * provides UI for
    * selecting if a window's tree is persisted
    * title of tree
    * tag editor
  * provides text note editing functionality
* go native app to
  * save trees to files
  * load trees from files
  * index files by tag and title (sqlite?)
  * UI for searching and opening trees (gio)

how to provide compatibility for syncing? locks? what about merging?
- update lock timestamp + device id(?) every time you edit the file
- should clear lock upon clean exit, in the event of not clean exit (or suspend)
- other clients can provide option to overwrite lock

-- do i even need this?
