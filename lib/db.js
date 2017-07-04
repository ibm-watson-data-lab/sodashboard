
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
var SOdbname = process.env.CLOUDANT_DB || 'questions';
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

// create custom_tags view if it doesn't already exist
var id = '_design/search';

var customtagsmap = function (doc) {
  if (doc.question) {
    emit("custom_tags", doc.custom_tags || []);
  }
}.toString();

var customtagsreduce = function (keys, values, rereduce) {
  var mergedvalues = [];
  for (var i=0; i<values.length; i++) {
    for (var j=0; j<values[i].length; j++) {
      if (mergedvalues.indexOf(values[i][j]) === -1) {
        mergedvalues.push(values[i][j]);
      }
    }
  }
  return mergedvalues.sort();
}.toString();

var customtagsddoc = {
  _id: id,
  views: {
    customtags: {
      map: customtagsmap,
      reduce: customtagsreduce
    }
  }
};

sodb.update(customtagsddoc).then(function() {
  console.log('design doc created');
});


// dashboard design documents
var alltickets = function(doc) {
  if (doc.question) {
    emit(doc.question.creation_date, null);
  }
};
var mytickets = function(doc) {
  if (doc.question && 
     (typeof doc.rejected === 'undefined' || doc.rejected === false) && 
     (typeof doc.answered === 'undefined' || doc.answered === false) &&
     doc.owner !== null) {
    emit(doc.owner, null);
  }
};
var unassignedtickets = function(doc) {
  if (!doc.rejected && !doc.answered && doc.owner === null) {
    emit(doc.question.creation_date, null);
  }
};
var dashboarddoc = {
  _id: '_design/dashboard',
  views: {
    alltickets: {
      map: alltickets.toString()
    },
    mytickets: {
      map: mytickets.toString()
    },
    unassignedtickets: {
      map: unassignedtickets.toString()
    }
  },
  language: "javascript"
};
console.log(dashboarddoc);
sodb.update(dashboarddoc).then(function() {
  console.log('dashboard design doc created');
});




module.exports = {
  tokens: tokensdb,
  so: sodb,
  url: safeurl
};