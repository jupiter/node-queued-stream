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

  // Bind events
  this.once('error', this.destroy.bind(this));

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
  return this;
};

prototype.destroy = function() {
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
    return this.destroy();
  }

  self._clearCurrentStream();
  self.currentStream = readable;
  self.currentBytes = 0;
  self.expectedBytes = expectedBytes;

  readable.on('end', function(){
    if (self.currentStream !== this) return;
    if (self._transformState.writechunk) {
      // Allow transforming queued chunk
      self._shouldNextStream = true;
    } else {
      self._nextStream();
    }
  });
  readable.on('error', function(err) {
    if (self.currentStream !== this) return;
    process.nextTick(self.emit.bind(self, 'error', err));
  });
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
  this.currentStream = null;
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
    self.destroy();
  } else if (self.expectedBytes === self.currentBytes) {
    self._nextStream();
  } else if (self._shouldNextStream) {
    self._shouldNextStream = false;
    // Allow writing to complete before switching
    process.nextTick(self._nextStream.bind(self));
  }
  cb();
};

module.exports = QueuedStream;
