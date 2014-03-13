/**
 * Church info crawler
 *
 * @author Jakub Zitny
 * @since Thu Mar 13 14:44:02 HKT 2014
 *
 * TODO: schedule times, googlemaps, objects
 *
 */

var request = require('request');
var cheerio = require('cheerio');
var http = require('http');
var cradle = require('cradle');

// web consts
var street_label = "SK: ";
var phone_label = "Tel. ";
var email_label = "E-mail: ";
var br = "<br>";

// setup
var url = 'http://concordiapax.byl.cz/';
var db_credentials = {
  username: 'parser',
  password: 'parser.123456'
}
var db_url = 'http://178.77.239.163/';
var db_name = "massnow";

// church
function ChurchObject(name, street, city, phones, web, email, schedule) {
  this.name = name;
  this.shortname = shortenString(name);
  this.street = street;
  this.city = city;
  this.phones = phones;
  this.web = web;
  this.email = email;
  this.schedule = schedule;
}

// mode
var mode = process.argv[2];

if (mode == "upload") {
  var c = new(cradle.Connection)(db_url, 80, { auth: db_credentials });
  var db = c.database(db_name);
  db.exists(function (err, exists) {
    if (err) {
      console.log('error', err);
    } else if (exists) {
      //console.log('connecting to db');
    } else {
      console.log('creating db');
      db.create();
    }
  });
}

// parse the homepage and crawl
request(url, function(err, resp, body){
    loadLinks(body);
});

/**
 * loads links from homepage pointing to pages
 * retrieves data from each page
 */
function loadLinks(body) {
  $ = cheerio.load(body);
  links = $('div ul li a');
  $(links).each(function(i, link){
    var section = $(link).text();
    var link = $(link).attr('href');
    request(url+link, function(err, resp, body){
      if (section.indexOf("Praha") != -1) {
        loadPage(body, section);
      }
    });
  });
}

/**
 * parses single page
 * if debug is set it prints markdown info
 * if upload is set it uploads data to cdb
 */
function loadPage(body, section) {
  if (mode == "debug") {
    console.log(section);
    console.log("====================");
  }
  $ = cheerio.load(body);
  rows = $('div.stranka table tr').next();
  page_churches = new Array();
  while (true) {
    $ = cheerio.load(rows.html());
    name = clearString($('b').html().replace(/\r\n/g, "").replace(/\ \ \ \ /g, " "));
    col1 = $('td');
    col2 = col1.next();
    col3 = col2.next();
    if (mode == "debug") {
      console.log(name);
      console.log("---------------------");
    }
    processChurch(name, section, col1, col2, col3);
    rows = rows.next();
    if (rows.html() == null) break;
  }
}

/**
 * processes single church
 */
function processChurch(name, city, col1, col2, col3) {
  text = col1.html();
  var street = processChurchStreet(text);
  var city = trimString(city);
  var phones = processChurchPhones(text);
  var web = $('a').attr('href'); // nicer TODO
  var email = processChurchEmail(text);
  var schedule = processChurchMasses(text);
  var church = new ChurchObject(name, street, city, phones, web, email, schedule);

  if (mode == "upload") {
    uploadChurch(church);
  } else if (mode == "debug") {
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
}

/**
 * uploads church document to cdb
 */
function uploadChurch(church) {
  db.save(church,
    function (err, res) {
      if (err) {
        console.log(err);
      } else {
        console.log(church.shortname + " uploaded.");
      }
  });
}

/**
 * retrieves church street
 * @return string od street
 */ 
function processChurchStreet(text) {
  street_raw = text.substring(
    text.indexOf(street_label) + street_label.length,
    text.indexOf(phone_label, text.indexOf(street_label))
  );
  street = clearString(street_raw.substring(0, street_raw.lastIndexOf(br))
    .replace(/\r\n/g, "").replace(/\ \ \ \ /g, " "));
  return street;
}

/**
 * retrieves church phones
 * @return array of phones
 */ 
function processChurchPhones(text) {
  phones = new Array();
  if (text.indexOf(phone_label) != -1) {
    if (text.indexOf(br, text.indexOf(phone_label)) == -1) {
      phone = text.substring(
        text.indexOf(phone_label) + phone_label.length,
        text.length
      );
    } else {
      phone = text.substring(
        text.indexOf(phone_label) + phone_label.length,
        text.indexOf(br, text.indexOf(phone_label))
      );
    }
    // multiple or just one
    if (phone.indexOf(",") != -1) {
      phones = phone.split(",");
      for (i in phones) {
        phones[i] = trimString(phones[i]);
      }
    } else {
      phones.push(phone);
    }
  }
  return phones;
}

/**
 * retrieves church email
 * @return string of email
 */ 
function processChurchEmail(text) {
  email = undefined;
  if (text.indexOf(email_label) != -1) {
    email = text.substring(
      text.indexOf(email_label) + email_label.length,
      text.length
    );
    if (email.indexOf(",") != -1)
      email = email.substring(0, email.indexOf(","));
    if (email.indexOf("<a") != -1)
      email = email.substring(0, email.indexOf("<a"));
  }
  return email;
}

/**
 * retrieves church masses
 * @return array of days and masses (array index is day 1-7)
 */ 
function processChurchMasses(text) {
  schedule = new Array();
  sched_raw = col2.html().split(br);
  times_raw = col3.html().split(br);
  var prev_day;
  for (var i = 0; i < sched_raw.length; i++) {
    day = trimString(clearString(sched_raw[i]));
    time = trimString(clearString(times_raw[i]));
    // days
    if (day == '') day = prev_day;
    for (j = 1; j <= 7; j++) {
      if (processChurchMassesDays(j, day)) {
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
}

/**
 * is processing day in day_label?
 * @param day processing day
 * @param day_label the label of day we have
 * @return true or false
 */
function processChurchMassesDays(day, day_label) {
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

/**
 * clears dirty string
 */
function clearString(string) {
  return string.replace(/<b>/g, "").replace(/<\/b>/g, "")
    .replace(/&nbsp/g, "").replace(/;;/g, ";").replace('\r\n', "")
    .replace(/<br>/g, "");
}

/**
 * trims whitespace from beginning
 * and end of given string
 */
function trimString (string) {
    return string.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

/**
 * shortens string for ascii string ids / shortnames
 * replaces czech specific letter with english ones
 * removes other useless stuff
 */
function shortenString(string){
  string = string.toLowerCase();
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
  return string.replace(/\ */g, '');
}

