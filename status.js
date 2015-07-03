'use strict';

var http = require('http');
var async = require('async');
var chalk = require('chalk');

var subreddits = {};

var scanInterval;
var scanCount = 0;

function getJSON(url, cb) {
  http.get(url, function(response) {
    var body = '';
    response.on('error', cb);
    response.on('data', function(data) {
      body += data;
    });

    response.on('end', function() {
      cb(null, JSON.parse(body));
    });
  });
}

function populateSubreddit(listing, cb) {
   if (listing.kind !== 't5') {
     return cb('not a subreddit');
   }

   listing = listing.data;
   var name = listing.display_name;
   subreddits[name] = {
     status: listing.subreddit_type,
     substatus: listing.submission_type,
     description: listing.public_description
   };

   console.log(chalk.grey('scan'), chalk.bold.yellow(name),
       chalk[subreddits[name].status === 'public' ? 'green' : 'red'](subreddits[name].status),
       chalk[subreddits[name].substatus === 'any' ? 'green' : 'red'](subreddits[name].substatus));
   cb(null, subreddits[name]);
}

function scanSubreddits(after) {
  var url = 'http://www.reddit.com/reddits.json?';
  if (scanCount) {
    url += 'count=' + scanCount;
  }
  if (after) {
    url += '&after=' + after;
  }

  getJSON(url, function(err, json) {
    if (err) {
      throw err;
    }

    scanCount += 25;

    async.each(json.data.children, function(listing, cb) {
      populateSubreddit(listing, cb);
    }, function() {
      setTimeout(function() {
        scanSubreddits(json.data.after);
      }, 1000);
    });
  });
}

scanSubreddits();

function getSpecificSubreddit(subreddit, cb) {
  if (subreddits[subreddit]) {
    return cb(null, subreddits[subreddit]);
  }

  getJSON('http://www.reddit.com/subreddits/search.json?q=' + subreddit,
      function(err, json) {
        if (err) {
          return cb(err);
        }

        populateSubreddit(json.data.children[0], cb);
      });
}

module.exports = {
  subreddits: subreddits,
  get: getSpecificSubreddit
};
