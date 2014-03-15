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
var config = common.config();
var climode = (process.argv[0] == 'node') ? process.argv[2] : process.argv[1];

// parse the homepage and crawl
pp = new logic.PragueParser();
pp.run(climode);

