
// dependencies
var cloudantqs = require('cloudant-quickstart');
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

// use cloudant-quickstart to work on the databases
var tokensdb = cloudantqs(url, 'tokens');
var sodb = cloudantqs(url, SOdbname);
var eventsdb = cloudantqs(url, 'events');

// create databases, if they don't already exist
var opts = { indexAll: false };
Promise.all([
  tokensdb.create(opts),
  sodb.create(opts)
]).then(function() {
  console.log('databases created');
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
var alltagsmap = function (doc) {
  var c = []
  if (doc.custom_tags) {
    c = doc.custom_tags
  }
  var t = []
  if (doc.question && doc.question.tags) {
    t = doc.question.tags
  }

  t = t.filter(function (tag) {
    return c.indexOf(tag) === -1
  }).concat(c)

  if (t && t.length > 0) {
    emit('alltags', t)
  }
};
var alltagsreduce = function (keys, values, rereduce) {
  var mergedvalues = []
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      if (mergedvalues.indexOf(values[i][j]) === -1) {
        mergedvalues.push(values[i][j])
      }
    }
  }
  return mergedvalues.sort()
};
var usertagsmap = function (doc) {
  if (doc.user_id) {
    emit(doc.user_id, doc.custom_tags || []);
  }
}
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
    },
    alltags: {
      map: alltagsmap.toString(),
      reduce: alltagsreduce.toString()
    },
    usertags: {
      map: usertagsmap.toString()
    }
  },
  language: "javascript"
};

sodb.update(dashboarddoc).then(function() {
  console.log('dashboard design doc created');
});




module.exports = {
  tokens: tokensdb,
  so: sodb,
  events: eventsdb,
  url: safeurl
};