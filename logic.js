/**
 * TODO
 * sync returns, multithr
 * schedtimes, gmaps
 * fixparse praha, tayin, http://bit.ly/1oSYOtr
 */

/**
 * Objects.
 */

var Church = function(name, street, city, phones, web, email, schedule, geo) {
  this.name = name;
  var sh = require('shorthash');
  var hash = sh.unique(street);
  if (street == "") {
    hash = sh.unique(name);
  }
  this.shortname =  hash + "_" + name.idify();
  this.street = street;
  this.city = city;
  this.phones = phones;
  this.web = web;
  this.email = email;
  this.schedule = schedule;
  this.geo = geo;
}


/**
 *
 * https://developers.google.com/maps/documentation/geocoding/#Geocoding
 */
var GeoLocator = function(config, country_code) {
  this.protocol = "https"; 
  this.http = require(this.protocol);
  this.url_builder = require('url');
  this.mapconfig = config["var"].map;
  this.url_o = {
    protocol: this.protocol,
    host: "maps.googleapis.com",
    pathname: "/maps/api/geocode/json",
    query: {
      key: config["var"].gapi_key,
      sensor: "false",
      region: country_code,
      language: "cs",
      components: "country:" + country_code.toUpperCase(),
      address: ""
    }
  };

  /**
   * thx to http://stackoverflow.com/a/16155551/1893452
   */
  this.findLocation = function(address) {
    this.url_o.query.address = address;
    var url = this.url_builder.format(this.url_o);
    var self = this;
    this.http.get(url, function (response) {
      var buffer = "";
      var data;
      var route;
      response.on("data", function (chunk) {
          buffer += chunk;
      }); 
      response.on("end", function (err) {
        data = JSON.parse(buffer);
        if (err || data.status != 'OK') {
          // TODO handle these
          console.error("error", err);
        } else {
          res_o = data.results[0].geometry.location;
          res_a = [res_o.lng, res_o.lat];
          //console.log(address);
          //console.log(data.results[0].formatted_address);
          self.emit("found", res_a);
        }
      }); 
    }); 
  };

};

GeoLocator.prototype.__proto__ = require('events').EventEmitter.prototype;

var CouchUploader = function(config) {
  this.dbUrl = "http://" + config["var"].db.credentials.username + ":" +
    config["var"].db.credentials.password + "@" +
    config["var"].db.host + ":" + config["var"].db.port;
  this.nano = require('nano')(this.dbUrl);
  this.dbName = config["var"].db.name;
  this.db = this.nano.use(this.dbName);

  /**
   * creates db if it doesn't exist
   * thx to http://bit.ly/1qFnSJc
   * @since Thu May 15 13:53:24 CST 2014
   */
  this.insertDoc = function(doc, tried) {
    if (typeof tried === "undefined") {
      tried = 0;
    }
    var that = this;
    this.db.insert(doc,
      function (err, httpBody, httpHeaders) {
        if(err) {
          if(err.message === 'no_db_file' && tried < 1) {
            // create database and retry
            return that.nano.db.create(that.dbName, function (err, body) {
              if (err) {
                console.log("not created! " + err.message)
              } else {
                insert_doc(doc, tried+1);
              }
            });
          }
          else { return console.log(err); }
        }
        console.log(httpBody);
    });
  }
}

var CouchUploaderCradle = function(config) {
  this.cradle = require('cradle');
  this.db_credentials = config["var"].db.credentials;
  this.db_name = config["var"].db.name;
  this.db_url = config["var"].db.url;
  this.db = null;

  /**
   * creates db if it doesn't exist
   * @since Sat Mar 15 20:45:35 HKT 2014
   */
  this.createDb = function() {
    var that = this;
    var c = new(this.cradle.Connection)(this.db_url, 5984, {
      auth: that.db_credentials
    });
    this.db = c.database(this.db_name);
    var calls = [];
    var exFunc = function (err, exists) {
      if (err) {
        console.log('error', err);
      } else if (exists) {
        console.log('destroying old db');
        that.destroyDb();
        console.log('creating db');
        that.db.create();
      } else {
        console.log('creating db');
        that.db.create();
      }
    };
    async.series([
      this.db.exists(exFunc),
      console.log("fin"),
    ]);

      console.log("asd");
  };

  /**
   * uploads/updates given church in cdb
   * @since Sat Mar 15 20:45:35 HKT 2014
   * @param church filled Church object
   */
  this.uploadChurch = function(church) {
    // TODO check for existence and changes
    this.db.save(church,
      function (err, res) {
        if (err) {
          console.log(err);
        } else {
          console.log(church.shortname + " uploaded.");
        }
    });
  };

  /**
   * retrieves church by id
   * returns Church object
   * TODO
   */
  this.getChurch = function(id) {
    console.log("not implemented yet");
  }

  /**
   * destroys db
   */
  this.destroyDb = function() {
    var that = this;
    var c = new(this.cradle.Connection)(this.db_url, 5984, {
      auth: that.db_credentials
    });
    this.db = c.database(this.db_name);
    this.db.destroy();
  }

};

var Parser = {};

Parser.prototype = {
  br: "<br>",
  mode: null,
  config: null,
  cheerio: require('cheerio'),
  request: require('request'),
  couchUploader: null,
  run: function(config) {
    this.mode = config.mode;
    this.config = config;
    this.couchUploader = new CouchUploader(config);
    var that = this;
    this.request(this.url, function(e, r, b){
      that.loadLinks(b);
    });
  }
};

function TaipeiParser() {
  this.urlbase = "http://www.catholic.org.tw/en/";
  this.url = this.urlbase + "congreMassTpe.html";
  this.address_label = "Address";
  this.phone_label = "Telephone";
  this.email_label = "E-mail";
  this.website_label = "Website";

  /**
   * TODO extract deanery, city, area
   */
  this.loadLinks = function(body) {
    $ = this.cheerio.load(body);
    links = $('body span a'); 
    var that = this;
    $(links).each(function(i, link){
      var name = $(link).text();
      var page = $(link).attr('href');
      var anchor = false;
      if ($(link).attr('name') == "top")
        anchor = true;
      that.request(that.urlbase+page, function(e, r, b){
        if (name.indexOf("TOP") == -1 && name.indexOf("HOME") == -1 && !anchor) {
          //console.log("processing: " + name + "(" + name.length + ") " + that.urlbase+page);
          that.loadPage(b, name);
        }
      });
    });
  };

  /**
   *
   */
  this.loadPage = function(body, name) {
    $ = this.cheerio.load(body);
    rows = $('body table tr th').next();
    var address = rows.next().text().trim();

    gl = new GeoLocator(this.config, "tw");
    gl.findLocation(address);

    rows = $('body table tr').next();
    var schedule_raw = [];
    var phones = [];
    var email = null;
    var web = null;
    var current_day = null;
    while(true) {
      if (rows.html() == null) break;
      $ = this.cheerio.load(rows.html());
      td = $('td');
      if (td.html()) {
        var desc = td.html().removeTags();
      } else var desc = "";
      var data = td.next().text().trim();
      if (desc.indexOf(this.phone_label) != -1) {
        phones = this.processChurchPhones(data);
      } else if (desc.indexOf(this.email_label) != -1) {
        email = data;
      } else if (desc.indexOf(this.website_label) != -1) {
        web = data;
      } else if (desc.indexOf("day") != -1) {
        current_day = desc;
        schedule_raw[desc] = data;
      } else if (current_day && desc.indexOf("Mass") == -1) {
        // hack to count also unlabeled days
        while (schedule_raw.hasOwnProperty(current_day)) {
          current_day += "x";
        }
        schedule_raw[current_day] = data;
      }
      rows = rows.next();
    }
    var schedule = this.processChurchMasses(schedule_raw);
    var that = this;
    gl.on("found", function(res) {
      var geo = {
        "long": res[0],
        "lat": res[1]
      };
      return that.processChurch(name, address, phones, email, web, schedule, geo);
    });
  }

  /**
   *
   */
  this.processChurch = function(name, address, phone, email, web, schedule, geo) {
    var church = new Church(name, address, "Taipei", phone, web, email, schedule, geo);
    if (this.mode == "upload") {
      this.couchUploader.insertDoc(church);
    } else if (this.mode == "debug") {
      console.log(name);
      console.log("---------------------");
      console.log("**Web:** " + church.web + "\n");
      console.log("**E-mail:** " + church.email + "\n");
      console.log("**GEO:** " + geo + "\n");
      console.log("**Street:** " + church.street + "\n");
      console.log("**City:** " + church.city + "\n");
      console.log("**Phones:**\n");
      console.log(church.phones);
      console.log();
      console.log("**Schedule:**\n");
      for (i in church.schedule) {
        for (j in church.schedule[i]) {
          console.log("Day "+i+":", church.schedule[i][j].time,
            church.schedule[i][j].lang);
          console.log();
        }
      }
    }
    return church;
  };

  /**
   *
   */
  this.processChurchPhones = function(phones_raw) {
    prefix = phones_raw.getParContent();
    phones = phones_raw.replace(/\(.*\)/g, "").split(",");
    for (i in phones) {
      if (phone = phones[i].match(/[0-9]{4}\-[0-9]{4}/)) {
        phones[i] = "("+prefix+")" + phone;
      } else {
        delete phones[i];
        phones.length -= 1;
      }
    }
    return phones;
  }

  /**
   *
   */
  this.processChurchMasses = function(schedule_raw) {
    var schedule = [];
    for (i = 1; i <= 7; i++) {
      schedule[i] = [];
    }
    for (day_raw in schedule_raw) {
      if (!(time = schedule_raw[day_raw].match(/..\:../))){
        continue;
      }
      var timelang = {
        'time': time[0],
        'lang': schedule_raw[day_raw].getParContent()
      }
      if (day_raw.indexOf("Tuesday - Friday") != -1) {
        for (i = 2; i <= 5; i++) {
          schedule[i].push(timelang);
        }
      } else if (day_raw.indexOf("Monday") != -1) {
        schedule[1].push(timelang);
      } else if (day_raw.indexOf("Tuesday") != -1) {
        schedule[2].push(timelang);
      } else if (day_raw.indexOf("Wednesday") != -1) {
        schedule[3].push(timelang);
      } else if (day_raw.indexOf("Thursday") != -1) {
        schedule[4].push(timelang);
      } else if (day_raw.indexOf("Friday") != -1) {
        schedule[5].push(timelang);
      } else if (day_raw.indexOf("Saturday") != -1) {
        schedule[6].push(timelang);
      } else if (day_raw.indexOf("Sunday") != -1) {
        schedule[7].push(timelang);
      } else if (day_raw.indexOf("Weekday") != -1) {
        for (i = 1; i <= 5; i++) {
          schedule[i].push(timelang);
        }
      } else {
        console.log("error:", day_raw);
      }
    }
    return schedule;
  };

};

TaipeiParser.prototype = Object.create(Parser.prototype);
TaipeiParser.prototype.constructor = TaipeiParser;

function PragueParser() {
  this.url = "http://concordiapax.byl.cz/";
  this.street_label = "SK: ";
  this.phone_label = "Tel. ";
  this.email_label = "E-mail: ";

  /**
   *
   */
  this.loadLinks = function(body) {
    $ = this.cheerio.load(body);
    links = $('body div ul li a'); 
    var that = this;
    $(links).each(function(i, link){
      console.log(link);
      var section = $(link).text();
      var page = $(link).attr('href');
      that.request(that.url+page, function(e, r, b){
        if (section.indexOf("Praha") != -1) {
          that.loadPage(b, section);
        }
      });
    });
  };

  /**
   * parses single page
   * if debug is set it prints markdown info
   * if upload is set it uploads data to cdb
   */
  this.loadPage = function(body, section) {
    if (this.mode == "debug") {
      console.log(section);
      console.log("====================");
    }
    $ = this.cheerio.load(body);
    rows = $('div.stranka table tr').next();
    page_churches = [];
    while (true) {
      $ = this.cheerio.load(rows);
      name = $('b').html().clearNls();
      col1 = $('td');
      col2 = col1.next();
      col3 = col2.next();
      if (this.mode == "debug") {
        console.log(name);
        console.log("---------------------");
      }
      this.processChurch(name, section, col1, col2, col3);
      rows = rows.next();
      if (rows.html() == null) break;
    }
  };

  /**
   *
   */
  this.processChurch = function(name, city, col1, col2, col3) {
    text = col1.html();
    var street = this.processChurchStreet(text);
    var city = city.trim();
    var phones = this.processChurchPhones(text);
    var web = $('a').attr('href'); // nicer TODO
    var email = this.processChurchEmail(text);
    var schedule = this.processChurchMasses(text);
    var church = new Church(name, street, city, phones, web, email, schedule);

    gl = new GeoLocator(this.config, "cz");
    gl.findLocation(street);
    gl.on("found", function(res) {
      console.log(res);
    });
  
    if (this.mode == "upload") {
      // TODO
      uploadChurch(church);
    } else if (this.mode == "debug") {
      console.log("**Web:** " + church.web + "\n");
      console.log("**E-mail:** " + church.email + "\n");
      console.log("**Street:** " + church.street + "\n");
      console.log("**City:** " + church.city + "\n");
      console.log("**Phones:**\n");
      console.log(church.phones);
      console.log();
      console.log("**Schedule:**\n");
      console.log(church.schedule);
      console.log();
    }
    return church;
  };

  /**
   * retrieves church street
   * @return string od street
   */ 
  this.processChurchStreet = function(text) {
    street_raw = text.substring(
      text.indexOf(this.street_label) + this.street_label.length,
      text.indexOf(this.phone_label, text.indexOf(this.street_label))
    );
    street = street_raw.substring(0, street_raw.lastIndexOf(this.br)).clearNls();
    return street;
  };
  
  /**
   * retrieves church phones
   * @return array of phones
   */ 
  this.processChurchPhones = function(text) {
    phones = [];
    if (text.indexOf(this.phone_label) != -1) {
      if (text.indexOf(this.br, text.indexOf(this.phone_label)) == -1) {
        phone = text.substring(
          text.indexOf(this.phone_label) + this.phone_label.length,
          text.length
        );
      } else {
        phone = text.substring(
          text.indexOf(this.phone_label) + this.phone_label.length,
          text.indexOf(this.br, text.indexOf(this.phone_label))
        );
      }
      // multiple or just one
      if (phone.indexOf(",") != -1) {
        phones = phone.split(",");
        for (i in phones) {
          phones[i] = phones[i].trim();
        }
      } else {
        phones.push(phone);
      }
    }
    return phones;
  };
  
  /**
   * retrieves church email
   * @return string of email
   */ 
  this.processChurchEmail = function(text) {
    email = undefined;
    if (text.indexOf(this.email_label) != -1) {
      email = text.substring(
        text.indexOf(this.email_label) + this.email_label.length,
        text.length
      );
      if (email.indexOf(",") != -1)
        email = email.substring(0, email.indexOf(","));
      if (email.indexOf("<a") != -1)
        email = email.substring(0, email.indexOf("<a"));
    }
    return email;
  };
  
  /**
   * retrieves church masses
   * @return array of days and masses (array index is day 1-7)
   */ 
  this.processChurchMasses = function(text) {
    schedule = [];
    sched_raw = col2.html().split(this.br);
    times_raw = col3.html().split(this.br);
    var prev_day;
    for (var i = 0; i < sched_raw.length; i++) {
      day = sched_raw[i].clear().trim();
      time = times_raw[i].clear().trim();
      // days
      if (day == '') day = prev_day;
      for (j = 1; j <= 7; j++) {
        if (this.processChurchMassesDays(j, day)) {
          if (j == 7 && schedule[7]) {
            schedule[7] += time;
          } else {
            schedule[j] = time;
          }
        }
      }
      prev_day = day;
    }
    return schedule;
  };
  
  /**
   * is processing day in day_label?
   * @param day processing day
   * @param day_label the label of day we have
   * @return true or false
   */
  this.processChurchMassesDays = function(day, day_label) {
    switch(day) {
      case 1:
        if (day_label.indexOf('Po') != -1)
          return true;
        break;
      case 2:
        if (day_label.indexOf('Út') != -1
            || day_label.indexOf('Po – So') != -1
            || day_label.indexOf('Po – Pá') != -1
            || day_label.indexOf('Po – Čt') != -1
            || day_label.indexOf('Po – St') != -1)
          return true;
        break;
      case 3:
        if (day_label.indexOf('St') != -1
            || day_label.indexOf('Út – Čt') != -1
            || day_label.indexOf('Út – So') != -1
            || day_label.indexOf('Út – Pá') != -1
            || day_label.indexOf('Po – So') != -1
            || day_label.indexOf('Po – Pá') != -1
            || day_label.indexOf('Po – Čt') != -1
            || day_label.indexOf('Út – So') != -1)
          return true;
        break;
      case 4:
        if (day_label.indexOf('Čt') != -1
            || day_label.indexOf('Út – So') != -1
            || day_label.indexOf('Út – Pá') != -1
            || day_label.indexOf('Po – So') != -1
            || day_label.indexOf('Po – Pá') != -1
            || day_label.indexOf('St – Pá') != -1)
          return true;
        break;
      case 5:
        if (day_label.indexOf('Pá') != -1
            || day_label.indexOf('Út – So') != -1
            || day_label.indexOf('Po – So') != -1
            || day_label.indexOf('Čt – So') != -1)
          return true;
        break;
      case 6:
        if (day_label.indexOf('So') != -1)
          return true;
        break;
      case 7:
        if (day_label.indexOf('Ne') != -1)
          return true;
        break;
    }
    return false;
  }
}

PragueParser.prototype = Object.create(Parser.prototype);
PragueParser.prototype.constructor = PragueParser;

/**
 * Exports.
 */
exports.Church = Church;
exports.GeoLocator = GeoLocator;
exports.CouchUploader = CouchUploader;
exports.PragueParser = PragueParser;
exports.TaipeiParser = TaipeiParser;

/**
 * Helpers.
 */

/**
 * clears dirty fetched string
 * @since Sat Mar 15 21:00:01 HKT 2014
 */
String.prototype.clear = function() {
  return this.replace(/<b>/g, "").replace(/<\/b>/g, "")
    .replace(/&nbsp/g, "").replace(/;;/g, ";").replace('\r\n', "")
    .replace(/<br>/g, "");
}

/**
 * trims whitespaces from beginning and end of string
 * @since Sat Mar 15 20:58:37 HKT 2014
 */
String.prototype.trim = function() {
    return this.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

/**
 * removes newlines \r\n and indents from string
 * @since Sun Mar 16 03:25:29 HKT 2014
 */
String.prototype.clearNls = function() {
  return this.replace(/\r\n/g, "").replace(/\ \ \ \ /g, " ")
    .clear();
}

/**
 * shortens string for ascii string ids / shortnames
 * replaces czech specific letter with english ones
 * removes other useless stuff
 * reason: to create readable ids/shortnames
 * @since Sat Mar 15 20:56:46 HKT 2014
 */
String.prototype.idify = function() {
  var string = this.toLowerCase();
  string = string.replace(/á/g, 'a');
  string = string.replace(/č/g, 'c');
  string = string.replace(/ď/g, 'd');
  string = string.replace(/ě/g, 'e');
  string = string.replace(/é/g, 'e');
  string = string.replace(/í/g, 'i');
  string = string.replace(/ň/g, 'n');
  string = string.replace(/ó/g, 'o');
  string = string.replace(/ř/g, 'r');
  string = string.replace(/š/g, 's');
  string = string.replace(/ť/g, 't');
  string = string.replace(/ú/g, 'u');
  string = string.replace(/ů/g, 'u');
  string = string.replace(/ý/g, 'y');
  string = string.replace(/ž/g, 'z');
  string = string.replace(/\./g, '');
  string = string.replace(/\,/g, '');
  string = string.replace(/\-/g, '');
  string = string.replace(/\–/g, '');
  string = string.replace(/\'/g, '');
  string = string.replace(/ő/g, '');
  string = string.replace(/\ */g, '');
  return string;
}

/**
 *
 */
String.prototype.removeTags = function() {
  return this.replace(/<.*?>/g, "");
}

String.prototype.removePars = function() {
  return this.replace(/\(/, "").replace(/\)/, "");
}

String.prototype.getParContent = function() {
  var match = this.match(/\(.*\)/)
  return (match) ? match[0].removePars() : null;
}
