
// dependencies
var silverlining = require('silverlining');
var URL = require('url');

// extract the Cloudant URL from an environment variable
var url = process.env.CLOUDANT_URL;
if (!url) {
  console.error('Fatal error: expected CLOUDANT_URL environment variable');
  process.exit(1);
}
var parsed = URL.parse(url);
var SOdbname = 'so';
var safeurl = parsed.protocol + '//' + parsed.host + '/' + SOdbname;

// use silverlining to work on the databases
var tokensdb = silverlining(url, 'tokens');
var sodb = silverlining(url, SOdbname);

// create databases, if they don't already exist
var opts = { indexAll: false };
Promise.all([
  tokensdb.create(opts),
  sodb.create(opts)
]).then(function() {
  console.log('databases created');
});

module.exports = {
  tokens: tokensdb,
  so: sodb,
  url: safeurl
};