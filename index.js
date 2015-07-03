'use strict';

var express = require('express');
var async = require('async');

var statuses = require('./status.js');

function detectConfirmation(description, cb) {
  var detectors = [
    function(d, cb) {
      cb(/i?ama/i.test(d));
    },
    function(d, cb) {
      cb(/admin(istration)?\s+(re)?organization/i.test(d));
    }
  ];
  async.detect(detectors, function(fn, cb) {
    fn(description, cb);
  }, cb);
}

function PaoServ() {
  this.server = express();

  this.server.get('/r/:subreddit', function(req, res) {
    var subreddit = req.params.subreddit;
    if (!subreddit) {
      return res.status(404).send({error:'Subreddit not found: ' + subreddit});
    }

    statuses.get(subreddit, function(err, stat) {
      if (err) {
        return res.status(404)
          .send({error: 'Could not retrieve status: ' + err.toString()});
      }

      res.send(stat);
    });
  });

  this.server.get('/stats', function(req, res) {
    var keys = Object.keys(statuses.subreddits); // to avoid race conditions
    var obj = {
      scanned: keys.length,
      status: {
        confirmed: [],
        potential: [],
        unsure: [],
        open: []
      }
    };

    async.each(keys, function(key, cb) {
      var entry = statuses.subreddits[key];
      if (entry.status === 'private') {
        detectConfirmation(entry.description, function(detected) {
          if (detected) {
            obj.status.confirmed.push(key);
          } else {
            obj.status.potential.push(key);
          }
          cb();
        });
      } else if (entry.status !== 'public' || entry.substatus !== 'any') {
        obj.status.unsure.push(key);
        cb();
      } else {
        if (entry.status === 'public') {
          obj.status.open.push(key);
        } else {
          obj.status.unsure.push(key);
        }
        cb();
      }
    }, function(err) {
      if (err) {
        return res.status(500).send({error: err.toString()});
      }

      res.send(obj);
    });
  });
}

PaoServ.prototype = {
  start: function start() {
    // thanks http://stackoverflow.com/a/9166332/510036
    var port = process.env.PORT || 3000;
    this.server.listen(port, function() {
      console.log('listening on port', port);
    });
  }
};

module.exports.start = function start() {
  var serv = new PaoServ();
  serv.start();
};
