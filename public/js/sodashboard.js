var db = new PouchDB('sodashboard');

var locateDoc = function(id) {
  for(var i in app.docs) {
    var d = app.docs[i];
    if (d._id === id) {
      return d;
    }
  }
  return null;
};

var validateAssignment = function(sel, inp) {
  var uid = sel ? sel.options[sel.selectedIndex].value : (app.doc.owner || '');
  var uname = sel ? sel.options[sel.selectedIndex].text : '';
  if (uid === '' && app.doc.owner) {
    $('#assignUserBtn').prop('disabled', false).text('Unassign');
  } else if (uname && uid && uname.length>1 && uid.length == 9) {
    $('#assignUserBtn').prop('disabled', false).text('Assign');
  } else {
    var other = inp ? $(inp).val() : $('#otherOwner').val();
    if (other && other.trim() && other.length > 1) {
      $('#assignUserBtn').prop('disabled', false).text('Assign');
    } else {
      $('#assignUserBtn').prop('disabled', true).text('Assign');
    }
  }
};

var settingHash = false
var setHash = function () {
  settingHash = true
  var schema = '#/{questions}/{rejected}/{answered}/{search}/{tags}'
  var hash = schema.replace(/\{(.+?)\}/g, function ($0, $1) {
    if (app.queryBuilder.hasOwnProperty($1)) {
      return encodeURIComponent(app.queryBuilder[$1] || '-')
    } else {
      return '-'
    }
  })
  window.location.hash = hash
  console.log('hashes', hash)
  settingHash = false
}

var parseHash = function () {
  if (!settingHash) {
    if (window.location.hash && window.location.hash !== '#') {
      // schema: '#/{questions}/{rejected}/{answered}/{search}/{tags}'
      var hashes = window.location.hash.split('/')
      if (hashes[0] === '#profile') {
        app.profileEditor()
      } else if (hashes[0].startsWith('#edit?')) {
        var match = hashes[0].match(/[0-9]+$/)
        if (match) {
          app.edit(match[0])
        }
      } else {
        // hashes: [#, {questions}, {rejected}, {answered}, {search}, {tags}]
        console.log('hashes', hashes)
        settingHash = true // dont trigger performQuery, yet
        if (hashes.length > 1) app.queryBuilder.questions = hashes[1] === '-' ? 'unassigned' : hashes[1]
        if (hashes.length > 2) app.queryBuilder.rejected = (hashes[2] === 'true')
        if (hashes.length > 3) app.queryBuilder.answered = (hashes[3] === 'true')
        if (hashes.length > 4) app.queryBuilder.search = hashes[4] === '-' ? '' : decodeURIComponent(hashes[4])
        if (hashes.length > 5) app.queryBuilder.tags = !hashes[5] ? [] : decodeURIComponent(hashes[5]).split(',')

        app.search = app.queryBuilder.search
        $.each($('.taglimitlist input'), function (index, input) {
          var value = $(input).attr('id')
          if (app.queryBuilder.tags.indexOf(value) > -1) {
            $(input)[0].checked = true
          } else {
            $(input)[0].checked = false
          }
        })

        settingHash = false // now we can performQuery
        app.performQuery()
      }
    } else {
      settingHash = true // dont trigger performQuery, yet
      app.queryBuilder.questions = 'unassigned'
      app.queryBuilder.rejected = false
      app.queryBuilder.answered = false
      app.queryBuilder.search = ''
      app.search = ''
      app.queryBuilder.tags = []
      settingHash = false // now we can performQuery
      app.performQuery()
    }
  } else {
    settingHash = false
  }
}

Vue.component('tags-typeahead', {
  template: '#tags-typeahead',
  props: ['refid', 'reftags'],
  data: function () {
    return {
      customtagsfocus: false,
      suggestedtags: [],
      customtags: '',
      inputid: 'custom-tags-' + this.refid
    }
  },
  watch: {
    customtags: function (val, oldVal) {
      while (this.suggestedtags.length > 0) {
        this.suggestedtags.pop();
      }
      var t = val.trim().toLowerCase();
      if (t.length > 0 && this.reftags.length > 0) {
        for (var i = 0; i < this.reftags.length; i++) {
          if (this.reftags[i].indexOf(t) === 0) {
            this.suggestedtags.push(this.reftags[i]);
          }
        }
      }
    }
  },
  methods: {
    handleKeyNav: function (dir) {
      var isInput = document.activeElement.id === this.inputid;
      var isPrev = dir === 'prev';

      if (isInput && !isPrev) {
        document.querySelector('.suggestedtag').focus();
      } else if (!isInput && !isPrev) {
        if (document.activeElement.nextSibling) {
          document.activeElement.nextSibling.focus();
        }
      } else if (!isInput && isPrev) {
        if (document.activeElement.previousSibling) {
          document.activeElement.previousSibling.focus();
        } else {
          document.getElementById(this.inputid).focus();
        }
      }
    },
    selectcustomtag: function (tag) {
      this.customtags = tag;
      document.getElementById(this.inputid).focus();
    },
    addcustomtags: function (id) {
      var tags = this.customtags.split(',')
        .map(function (tag) {
          // normalize tags (i.e., lowercase, replace whitespace with hyphen)
          return tag.trim().toLowerCase().replace(/\s+/g, '-');
        })
        .filter(function (tag, idx, arr) {
          // remove empty and duplicate tags
          return tag && typeof tag === 'string' && arr.indexOf(tag) === idx;
        });

      var doc = null;
      if (app.doc && app.doc._id === id) {
        doc = app.doc;
      } else if (app.profile && app.profile._id === id) {
        doc = app.profile;
      }

      if (doc) {
        doc.custom_tags = doc.custom_tags || [];

        for (var t in tags) {
          if (doc.custom_tags.indexOf(tags[t]) === -1) {
            doc.custom_tags.push(tags[t]);
          }
        }

        var _this = this
        db.put(doc).then(function (data) {
          doc._rev = data.rev;
          _this.customtags = '';
        });
      }
    }
  }
})

var app = new Vue({
  el: '#app',
  data: {
    doc: null,
    docs: [],
    userlist: null,
    mode: 'unassigned',
    numDocs: null,
    loggedinuser: null,
    profile: null,
    syncInProgress: false,
    syncError: false,
    syncComplete: false,
    search: '',
    notetxt: '',
    alltags: [],
    soingesttags: [],
    sotags: [],
    mytags: [],
    taggedusers: [],
    customtagsfocus: false,
    showNotes: false,
    loading: false,
    queryBuilder: {
      questions: 'unassigned', // unassigned / mine / all
      tagsmode: 'or',          // or / and
      tags: [],                // array of tags to match
      rejected: false,         // false / true
      answered: false,         // false / true
      search: '',              // free-text search term
      sort: 'newestfirst'      // newestfirst
    },
    dateDisplayOpts: {
      weekday: 'long',
      hour: 'numeric', 
      minute: 'numeric',
      hour12: true,
      month: 'long', 
      day: 'numeric' }
  },
  watch: {
    queryBuilder: {
      handler: function (val, oldVal) {
        console.log('watch', settingHash)
        if (!settingHash) {
          this.performQuery()
        }
      },
      deep: true
    }
  },
  computed: {
    sortedDocs: function () {
      // get the app.docs but with tags sorted into order
      for(var i in this.docs) {
        this.docs[i].question.tags = this.docs[i].question.tags.sort();
      }
      return this.docs;
    },
    distinctSOTags: function () {
      return this.alltags.filter(function (t) {
        return app.mytags.indexOf(t) === -1 && app.soingesttags.indexOf(t) === -1
      })
    },
    distinctCustomTags: function () {
      var tags = this.mytags.filter(function (t) {
        return app.soingesttags.indexOf(t) === -1
      })
      return tags.concat(this.soingesttags).sort()
    },
    hasNotes: function () {
      if (this.docs) {
        return this.docs.some(function (doc) {
          return doc.notes && doc.notes.length > 0
        })
      } else {
        return false
      }
    }
  },
  methods: {
    notify: function(msg) {
      var opts = {
        element: 'body',
        position: null,
        type: "info",
        allow_dismiss: true,
        newest_on_top: false,
        offset: 20,
        spacing: 10,
        z_index: 1031,
        delay: 2500,
        timer: 1000,
        animate: {
          enter: 'animated fadeInDown',
          exit: 'animated fadeOutUp'
        }
      }
      $.notify({message: msg},opts);
    },
    edit: function(docid) {
      db.get(docid).then(function(data) {
        app.doc = data;
        app.mode = 'edit';
        app.notetxt = '';
        window.location.hash = '#edit?' + docid;

        app.getAllTags();
        app.findTaggedUsers();
      });
    },
    addNote: function() {
      if (!app.doc.notes) {
        app.doc.notes = [];
      }
      var obj = {
        time: new Date().toISOString(),
        note: app.notetxt,
        who: app.loggedinuser.user_name
      };
      app.doc.notes.push(obj);
      db.put(app.doc).then(function(data) {
        app.doc._rev = data.rev;
        app.notetxt = '';
      });
    },
    profileEditor: function(obj) {
      settingHash = true
      app.queryBuilder.questions = ''
      if (obj && !obj.clientX) { // make sure this isn't a MouseEvent 
        window.location.hash = '#profile';
        app.profile = obj;
        app.mode = 'profile';
        settingHash = false
      } else {
        // load the user profile
        db.get(app.loggedinuser._id).then(function (data) {
          // enable the profile editor
          window.location.hash = '#profile';
          app.profile = data;
          app.mode = 'profile';
          settingHash = false
        });
      }

      app.getAllTags();
    },
    saveProfile: function() {
      // save the profile to PouchDB
      db.put(app.profile).then(function(data) {
        // return to unassigned mode
        app.profile._rev = data.rev;
        app.queryBuilder.questions = 'unassigned'
      });
    },
    findTaggedUsers: function () {
      var t = []
      if (app.doc && app.doc.question) {
        if (app.doc.custom_tags) {
          app.doc.custom_tags.forEach(function (tag) {
            t.push(tag)
          })
        }
        if (app.doc.question.tags) {
          app.doc.question.tags.forEach(function (tag) {
            t.push(tag)
          })
        }
      }

      if (t.length > 0) {
        console.log('tags', t)
        db.search({
          query: t.join(' '),
          fields: ['custom_tags'],
          filter: function (doc) {
            return !!doc.user_id
          },
          mm: '1%', // (100 / t.length) + '%',
          include_docs: true
        }).then(function (resp) {
          if (resp && resp.rows) {
            app.taggedusers = resp.rows.map(function (row) {
              return {
                'user_id': row.doc.user_id,
                'user_name': row.doc.user_name
              }
            }).sort(function (a, b) {
              return a.user_name.localeCompare((b.user_name))
            })
          }
        })
      }
    },
    getMyTags: function () {
      db.query('dashboard/usertags', {key: app.loggedinuser._id})
        .then(function (resp) {
          if (resp && resp.rows) {
            app.mytags = resp.rows[0].value || []
          } else {
            app.mytags = []
            console.warn(resp)
          }
        })
        .catch(function (err) {
          app.mytags = []
          console.warn(err)
        })
    },
    getSOIngestTags: function () {
      // TODO: get configured tags for soingest
      app.soingesttags = [
        'cloudant', 'ibm-cloudant', 'pixiedust', 'data-science-experience',
        'compose', 'compose.io', 'apache-spark', 'jupyter-notebooks', 'ibm-bluemix'
      ]
    },
    getAllTags: function (customtags) {
      var compare = function (a, b) {
        if (a.toLowerCase() < b.toLowerCase()) return -1
        if (a.toLowerCase() > b.toLowerCase()) return 1
        return 0
      }
      db.query('dashboard/alltags')
        .then(function (resp) {
          if (resp && resp.rows) {
            app.alltags = (resp.rows[0].value || []).sort(compare)
          } else {
            console.warn(resp)
            app.alltags = []
          }
        })
        .catch(function (err) {
          console.warn(err)
          app.alltags = []
          app.sotags = []
        })

      if (customtags) {
        app.getMyTags()
        app.getSOIngestTags()
      }
    },
    onSyncChange: function(change) {
      // when we receive notification of a change
      app.syncInProgress = true;
      app.syncComplete = false;

      // if it's an incoming change (rather than us sending one to the cloud)
      if (change.direction === 'pull') {
        
        // for each change
        var inTheList = false;
        for (var i in change.change.docs) {
          var d = change.change.docs[i];
          
          // see if the document id that is changing is on our app.docs list
          for (var j in app.docs) {
            if (app.docs[j]._id === d._id) {
              // overwrite our copy with the one that has changed
              app.docs[j] = d;
              inTheList = true;
              break;
            }
          }

          // if we have a new unassigned ticket and we're in unassigned mode
          if (!intheList && app.queryBuilder.questions === 'unassigned' && d.owner === null && d.status === 'new') {
            // add it to the top of our list
            app.docs.unshift(d);
          }
        }
      }
      
    },
    onSyncPaused: function(err) {
      app.syncComplete = true;
      app.syncInProgress = false;

      // load the doc count
      db.info().then(function(data) {
        app.numDocs = data.doc_count;

        // get a list of users
        var map = function(doc) {
          if (doc.type && doc.type === 'user') {
            emit(doc.user_name, null);
          }
        };
        return db.query(map);
      }).then(function(users) {
        var userlist = {};
        for(var i in users.rows) {
          var u = users.rows[i];
          userlist[u.id] = u.key;
        }
        app.userlist = userlist;
      });
    },
    onSyncError: function(err) {
      // sync error
      app.syncInProgress = false;
      app.syncComplete = false;
      app.syncError = true;
      //app.notify('Sync error: ' + err.status + ' -  ' + err.message);
      console.log('error', err);
    },
    assign: function(id) {
      // called when someone clicks the assign button
      // find the doc that was rejected an update the database
      var doc = null;
      if (app.mode === 'edit') {
        doc = app.doc;
      } else {
        doc = locateDoc(id);
      }
      if (doc) {
        doc.owner = doc.owner ? doc.owner : null;
        doc.assigned = true;
        doc.assigned_by = app.loggedinuser.user_id;
        doc.assigned_by_name = app.loggedinuser.user_name;
        doc.assigned_at = new Date().toISOString();
        db.put(doc).then(function(reply) {
          if (app.queryBuilder.questions === 'mine' && doc.owner !== app.loggedinuser.user_id) {
            app.removeFromList(doc._id);
          } else if (app.queryBuilder.questions === 'unassigned' && doc.owner) {
            app.removeFromList(doc._id);
          } else {
            doc._rev = reply.rev;
          }
          app.notify('Question ' + doc._id + (doc.owner ? ' reassigned' : ' unassigned'));
          $('#assignUserBtn').text('Assign')
        });
      }
    },
    reject: function(id) {
      // called when someone calls the reject button
      // find the doc that was rejected and update the database
      var doc = null;
      if (app.mode === 'edit') {
        doc = app.doc;
      } else {
        doc = locateDoc(id);
      }

      if (doc) {
        doc.rejected = true;
        doc.rejected_by = app.loggedinuser.user_id;
        doc.rejected_by_name = app.loggedinuser.user_name;
        doc.rejected_at = new Date().toISOString();
        db.put(doc).then(function(reply) {
          doc._rev = reply.rev;
          app.removeFromList(id);
          app.notify('Question ' + doc._id + ' rejected');
        });
      }
    },
    answered: function(id) {
      // called when someone hits the answered button
      // find the doc that was answered and update the database
      var doc = null;
      if (app.mode === 'edit') {
        doc = app.doc;
      } else {
        doc = locateDoc(id);
      }
      if (doc) {
        doc.answered = true;
        doc.answered_by = app.loggedinuser.user_id;
        doc.answered_by_name = app.loggedinuser.user_name;
        doc.answered_at = new Date().toISOString();
        db.put(doc).then(function(reply) {
          doc._rev = reply.rev;
          app.removeFromList(id);
          app.notify('Question ' + doc._id + ' answered');
        });
      }
    },
    removecustomtag: function(id, tag) {
      var doc = null;
      if (app.doc && app.doc._id === id && app.doc.custom_tags) {
        doc = app.doc;
      } else if (app.profile && app.profile._id === id && app.profile.custom_tags) {
        doc = app.profile
      }

      if (doc) {
        doc.custom_tags = doc.custom_tags.filter(function(t, idx ,arr) {
          return t && typeof t === 'string' && t !== tag;
        });

        db.put(doc).then(function(data) {
          doc._rev = data.rev;
        });
      }
    },
    removeFromList: function(id) {
      for (var j in app.docs) {
        if (app.docs[j]._id === id) {
          console.log('Removed', id);
          app.docs.splice(j, 1);
          break;
        }
      }
    },
    logout: function() {
      db.destroy().then(function(data) {
        app.mode = 'loggedout'
      })
    },
    doSearch: function(callback) {
      if (app.queryBuilder.search) {
        db.search({
          query: app.queryBuilder.search,
          fields: ['question.title', 'question.tags', 'question.body'],
          include_docs: true
        }).then(function (data) {
          if (typeof callback === 'function') {
            callback(data.rows.map(function (r) { return r.doc }))
          } else {
            app.docs = [];
            for (var i in data.rows) {
                app.docs.push(data.rows[i].doc);
            }
            app.mode = 'search';
          }
        })
      } else if (typeof callback === 'function') {
        callback(null)
      }
    },
    calculateQuery: function() {
      var qb = this.queryBuilder;
      var q = {
        selector: {},
        sort: undefined
      };

      // tags
      var tagsclause= [];
      for (var i in qb.tags) {
        var obj = { 
          '$or': [
            {
              'custom_tags': {
                '$elemMatch': {
                  '$eq': qb.tags[i]
                }
               }
             },
             {
              'question.tags': {
                '$elemMatch': {
                  '$eq': qb.tags[i]
                }
               }
             }
          ]
        };
        tagsclause.push(obj);
      }

      // build selector
      var selector = {
        '$and': [ 
          { 'question.creation_date': {'$gt': 0 }}
        ]
      };
      if (qb.tags.length > 0) {
        var obj = {};
        obj['$' + qb.tagsmode] = tagsclause;
        selector['$and'].push(obj);
      }

      // add rejected
      if (!qb.rejected) {
        var obj = { 'rejected': { '$exists': false}};
        selector['$and'].push(obj);
      }

      // add answered
      if (!qb.answered) {
        var obj = { 'answered': { '$exists': false}}
        selector['$and'].push(obj)
      }

      // add questions
      selector['$and'].push({ 'type': 'question'})
      switch(qb.questions) {
        case 'unassigned': 
          selector['$and'].push({ 'owner': { '$type': 'null' }})
        break;
        case 'mine': 
          selector['$and'].push({ 'owner': this.loggedinuser._id })
        break;
        default: break;
      }

      // add to q
      q.selector = selector;

      // add sort
      q.sort = [ {'question.creation_date': 'desc'} ];
      return q;
    },
    performQuery: function () {
      app.docs = []
      app.loading = true
      setHash()
      var q = this.calculateQuery();
      console.log('query', JSON.stringify(app.queryBuilder))
      db.find(q).then(function (data) {
        app.doSearch(function (docs) {
          if (docs) {
            var ids = data.docs.map(function (doc) {
              return doc._id
            })
            app.docs = docs.filter(function (doc) {
              return ids.indexOf(doc._id) !== -1
            })
          } else {
            app.docs = data.docs
          }
          app.loading = false
          app.mode = 'search'
        })
      })
    },
    selectAllTags: function () {
      $.each($('.taglimitlist input:visible'), function (index, input) {
        $(input)[0].checked = true
      })
    },
    clearAllTags: function () {
      $.each($('.taglimitlist input'), function (index, input) {
        $(input)[0].checked = false
      })
    },
    selectMyTags: function () {
      $.each($('.taglimitlist input'), function (index, input) {
        var value = $(input).attr('id')
        if (app.mytags.indexOf(value) > -1) {
          $(input)[0].checked = true
        } else {
          $(input)[0].checked = false
        }
      })
    },
    showMoreTags: function () {
      $('#sotags').collapse('toggle')
      var b = $('.showmore-sotags')
      if (b.text() === 'Show More') {
        b.text('Show Less')
      } else {
        b.text('Show More')
        $.each($('#sotags input'), function (index, input) {
          $(input)[0].checked = false
        })
      }
    },
    submitTags: function () {
      settingHash = true
      app.queryBuilder.tags = []
      $.each($('.taglimitlist input:checked'), function (index, input) {
        app.queryBuilder.tags.push($(input).attr('id'))
      })
      settingHash = false
    }
  }
});

// on startup
db.get('_local/user').then(function(data) {

  // set the logged in user
  app.loggedinuser = data.user;

  // create the index
  db.createIndex({
    index: {
      fields: ['question.creation_date']
    }
  }).then(function (result) {
    console.log('Index creation success', result);
  }).catch(function (err) {
    console.log('Index creation error', err);
  });

  // sync with Cloudant
  var auth = data.username + ':' + data.password;
  var url = data.url.replace(/\/\//, '//' + auth + '@');
  var opts = { live: true, retry: true };

  db.replicate.from(url).on('complete', function(info) {
    console.log(info);
    console.log('initial sync complete - now syncing');
    parseHash();
    db.sync(url, opts)
      .on('change', app.onSyncChange)
      .on('paused', app.onSyncPaused)
      .on('error', app.onSyncError);
  }).on('error', app.onSyncError);;

  // if user has an incomplete profile, take them to their profile page
  // get profile from remote db because sync is probably not yet complete
  var rdb = new PouchDB(url);
  rdb.get(app.loggedinuser["_id"]).then(function (userdata) {
    if (!userdata.so_id) {
      app.profileEditor(userdata);
    } else {
      // parse the hash
      // console.log('pouchdb user id');
      parseHash();
    }
  }).catch(function(userdataerr) {
    console.warn(userdataerr);
  });

  app.getAllTags(true)

  $(window).on('hashchange', function(evt) {
    parseHash();
  });

}).catch(function(e) {
  // if there's no _local/user document, you're not logged in
  app.mode = 'loggedout'
});

$(document).ready(function() {

  $('#tagModal').on('show.bs.modal', function (e) {
    console.log('show modal!');
    setTimeout(function() {
      $('#tagsbutton').blur();
      $('#selectmine').focus();
    }, 100);

  })
  
  $('#tagModal').on('hide.bs.modal', function (e) {
    console.log('hide modal!');
    $('#tagsbutton').focus();
  })
})
