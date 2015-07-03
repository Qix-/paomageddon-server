'use strict';

var persistFile = './subreddits.json';

var http = require('http');
var async = require('async');
var chalk = require('chalk');
var fs = require('fs');

var subreddits = {};
var scanCount = 0;
var nextAfter = undefined;

try {
  var p = JSON.parse(fs.readFileSync(persistFile));
  if (p.scanCount && p.nextAfter && p.subreddits) {
    subreddits = p.subreddits || {};
    scanCount = p.scanCount;
    nextAfter = p.nextAfter;
  }
  console.log(chalk.bold.green('loaded persistence file'));
} catch (e) {
  console.warn(chalk.bold.yellow('Could not load persistence file: %s'),
        e.toString());
}

function getJSON(url, cb) {
  http.get(url, function(response) {
    var body = '';
    response.on('error', cb);
    response.on('data', function(data) {
      body += data;
    });

    response.on('end', function() {
      try {
        cb(null, JSON.parse(body));
      } catch(e) {
        cb(e);
      }
    });
  });
}

function populateSubreddit(listing, cb) {
   if (listing.kind !== 't5') {
     return cb('not a subreddit');
   }

   listing = listing.data;
   var name = listing.display_name;
   var update = name in subreddits;
   subreddits[name] = {
     status: listing.subreddit_type,
     substatus: listing.submission_type,
     description: listing.public_description
   };

   console.log(
       chalk.grey(update ? 'update' : 'detect'),
       chalk.bold.yellow(name),
       chalk[subreddits[name].status === 'public' ? 'green' : 'red'](subreddits[name].status),
       chalk[subreddits[name].substatus === 'any' ? 'green' : 'red'](subreddits[name].substatus));
   cb(null, subreddits[name]);
}

function scanSubreddits() {
  var url = 'http://www.reddit.com/reddits.json?';
  if (scanCount) {
    url += 'count=' + scanCount;
  }
  if (nextAfter) {
    url += '&after=' + nextAfter;
  }

  console.log(chalk.dim.grey(url));

  getJSON(url, function(err, json) {
    if (err) {
      // reschedule
      console.warn(
          chalk.bold.red("Request failed (retry in T-5): %s\n   url: %s"),
          err.toString(), url);
      setTimeout(function() {
        scanSubreddits();
      }, 5000);
      return;
    }

    scanCount += 25;
    nextAfter = json.data.after;

    async.each(json.data.children, function(listing, cb) {
      populateSubreddit(listing, cb);
    }, function() {
      setTimeout(function() {
        scanSubreddits();
      }, 800);
    });
  });
}

scanSubreddits();

function getSpecificSubreddit(subreddit, cb) {
  getJSON('http://www.reddit.com/subreddits/search.json?q=' + subreddit,
      function(err, json) {
        if (err) {
          return cb(err);
        }

        populateSubreddit(json.data.children[0], cb);
      });
}

// basic persistence
setInterval(function() {
  var contents = JSON.stringify({
    subreddits: subreddits,
    nextAfter: nextAfter,
    scanCount: scanCount
  });
  try {
    fs.writeFileSync(persistFile, contents);
    console.log(chalk.bold.green('wrote persistence file'));
  } catch(e) {
    console.error(chalk.bold.red('Could not write persistence: %s'),
        e.toString());
  }
}, 5000);

module.exports = {
  subreddits: subreddits,
  get: getSpecificSubreddit
};
