#!/usr/bin/env node

/**
 * Church info crawler logic
 *
 * @author Jakub Zitny
 * @since Thu Mar 13 14:44:02 HKT 2014
 *
 */


/**
 * Deps.
 */
var common = require('./common');
var logic = require('./logic');

/**
 * Config.
 */
var climode = (process.argv[0] == 'node') ? process.argv[2] : process.argv[1];
var config = common.config();
config.mode = climode;

// parse the homepage and crawl
// !!
//pp = new logic.PragueParser();
//pp.run(config);

pp = new logic.TaipeiParser();
pp.run(config);

//cu = new logic.CouchUploader(config);
//ch = new logic.Church("ch1", "adress", "city", ['123', '456'], "email@v.b", "www.com", []);
//cu.insertDoc(ch);

