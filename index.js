var util = require('util');
var stream = require('stream');

var QueuedStream = function(options) {
  if (!(this instanceof QueuedStream))
    return new QueuedStream(options);

  options = options || {};

  this.maxBytes = options.maxBytes; // End stream after processing max bytes
  this.expectedBytes = 0; // Switch to next queued stream after processing expected bytes
  this.currentBytes = 0;
  this.totalBytes = 0;
  this.queuedStreams = [];
  this.currentStream = null;

  stream.Transform.call(this, options);
};

util.inherits(QueuedStream, stream.Transform);

var prototype = QueuedStream.prototype;

prototype.append = function(readable, expectedBytes) {
  if (!this.currentStream) {
    this._switchStream(readable, expectedBytes);
  } else {
    this.queuedStreams.push(arguments);
  }
};

prototype.complete = function(soon) {
  this._clearCurrentStream();
  this.push(null);
};

prototype.getMaxChunkLength = function(n) {
  if (this.expectedBytes) {
    n = Math.min(this.expectedBytes - this.currentBytes, n);
  }
  if (this.maxBytes) {
    n = Math.min(this.maxBytes - this.totalBytes, n);
  }
  return n;
};

prototype._switchStream = function(readable, expectedBytes) {
  var self = this;

  if (!readable) {
    return this.complete();
  }

  self._clearCurrentStream();
  self.currentStream = readable;
  self.currentBytes = 0;
  self.expectedBytes = expectedBytes;
  self.currentStreamOnceEnd = function(){
    self._nextStream();
  };
  readable.once('end', self.currentStreamOnceEnd);
  readable.pipe(self, { end: false });
};

prototype._nextStream = function() {
  var self = this;

  if (!self.queuedStreams.length) return self._clearCurrentStream();

  var nextStream = self.queuedStreams.shift();
  self._switchStream(nextStream[0], nextStream[1]);
};

prototype._clearCurrentStream = function() {
  if (!this.currentStream) return;

  this.currentStream.unpipe(this);
  this.currentStream.removeAllListeners('end', this.currentStreamOnceEnd);
  this.currentStream = null;
  this.currentStreamOnceEnd = null;
};

prototype._transform = function(chunk, encoding, cb) {
  var self = this;

  var maxLength = self.getMaxChunkLength(chunk.length);
  if (maxLength < chunk.length) {
    chunk = chunk.slice(0, maxLength); // Discard the rest
  }

  self.push(chunk);
  self.totalBytes += chunk.length;
  self.currentBytes += chunk.length;

  if (self.totalBytes === self.maxBytes) {
    self._clearCurrentStream();
    self.push(null);
  } else if (self.expectedBytes === self.currentBytes) {
    self._nextStream();
  }
  cb();
};

module.exports = QueuedStream;
