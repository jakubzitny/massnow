var config = require('./config.json');

exports.config = function() {
  var node_env = process.env.NODE_ENV || 'development';
  config.port = config.env[node_env].port;
  config.env = config.env[node_env].env; // FIXME
  return config;
};
