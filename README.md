# MASSNOW — Intelligent church locator #

This is the main repository for our MassNow service project. More info about it is available in [this](https://docs.google.com/presentation/d/1W-AaGQdR1WVi7egmTBegTrFzYG-O6TgsFRCY5pWt2f4/edit?usp=sharing) presentation.

### Our project consisted of 3 main parts ###

* backend / api
* web frontend
* android app

### Testing ###

* http://couch.zitny.eu:5984 (couchdb entry endpoint)
* http://couch.zitny.eu:9200 (elasticsearch entry endpoint)
* http://couch.zitny.eu:5984/_utils/fauxton/ (couchdb fauxton admin interface)
* http://couch.zitny.eu:9200/_plugin/bigdesk/ (es bigdest monitoring plugin)
* http://couch.zitny.eu:9200/_plugin/HQ/#index/massnow_t (es HQ admin plugin)
* http://couch.zitny.eu/kibana/ (es kibana admin interface)
* http://couch.zitny.eu:3000 (web)

### Source code ###

* web, backend custom crawlers (javascript) — [this repo](https://bitbucket.org/hcimassnow/massnow/src)
* anroid app (java) — [this repo](https://bitbucket.org/hcimassnow/massnow-android/src)