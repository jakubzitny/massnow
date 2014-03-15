
/**
 * TODO
 * sync returns, multithr
 * schedtimes, gmaps
 */

/**
 * Objects.
 */

var Church = function(name, street, city, phones, web, email, schedule) {
  this.name = name;
  this.shortname = name.idify();
  this.street = street;
  this.city = city;
  this.phones = phones;
  this.web = web;
  this.email = email;
  this.schedule = schedule;
}

var CouchUploader = function(config) {
  this.cradle = require('cradle');
  this.db_credentials = config.credentials;
  this.db_name = config.name;
  this.db_url = config.url;
  this.db = null;

  /**
   * creates db if it doesn't exist
   * @since Sat Mar 15 20:45:35 HKT 2014
   */
  this.createDb = function() {
    var c = new(this.cradle.Connection)(this.db_url, 80, {
      auth: this.db_credentials
    });
    this.db = c.database(this.db_name);
    this.db.exists(function (err, exists) {
      if (err) {
        console.log('error', err);
      } else if (exists) {
        //console.log('connecting to db');
      } else {
        console.log('creating db');
        db.create();
      }
    });
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
   * TODO
   */
  this.destroyDb = function() {
    console.log("not implemented yet");
  }

};

var Parser = {};

Parser.prototype = {
  street_label: "SK: ",
  phone_label: "Tel. ",
  email_label: "E-mail: ",
  br: "<br>",
  mode: null,
  cheerio: require('cheerio'),
  request: require('request'),
  run: function(mode) {
    this.mode = mode;
    var that = this;
    this.request(this.url, function(e, r, b){
      that.loadLinks(b);
    });
  }
};

function PragueParser() {
  this.url = "http://concordiapax.byl.cz/";

  /**
   *
   */
  this.loadLinks = function(body) {
    $ = this.cheerio.load(body);
    links = $('div ul li a'); 
    var that = this;
    $(links).each(function(i, link){
      var section = $(link).text();
      var link = $(link).attr('href');
      that.request(that.url+link, function(e, r, b){
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

exports.Church = Church;
exports.CouchUploader = CouchUploader;
exports.PragueParser = PragueParser;

/**
 * Helper functions
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
  string = string.replace(/ő/g, '');
  string = string.replace(/\ */g, '');
  return string;
}

