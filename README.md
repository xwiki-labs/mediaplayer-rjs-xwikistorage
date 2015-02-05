# Introduction

This is an integration of the OfficeJS Media Player application ([http://mediaplayer.app.officejs.com/](http://mediaplayer.app.officejs.com)) with XWiki. It uses XWiki as a [JIO](http://www.j-io.org) storage and also provides an XWiki extension which embeds the Media Player in an XWiki page.

![Embedded Media Player](/static/mp.png?raw=true)

## Building and installing

In order to build you'll need [maven](http://maven.apache.org). Make sure you have a suitable `settings.xml` in your `.m2` directory as described [here](http://dev.xwiki.org/xwiki/bin/view/Community/Building).

* run `mvn install`
* Import the generated XAR under `mediaplayer-rjs-xwikistorage-extension/xar` to an XWiki instance.
