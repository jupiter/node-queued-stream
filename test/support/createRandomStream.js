var stream = require('stream');
var crypto = require('crypto');

// Creates a stream with random bytes
module.exports = function createRandomStream(options) {
  var bytes = options.totalBytes;
  var highWaterMark = options.highWaterMark || 16384;

  var randomReader = new stream.Readable({
    highWaterMark: highWaterMark
  });

  randomReader._read = function(size) {
    var stream = this;
    var outputBytes = Math.min(bytes, size);

    if (!outputBytes) {
      if (options.error) {
        stream.emit('error', options.error);
        return;
      }
      return this.push(null); // End stream
    }

    bytes -= outputBytes;
    var chunk = new Buffer(crypto.randomBytes(outputBytes));

    // Required to prevent maximum call stack size
    setImmediate(function(){
      stream.push(chunk);
    });
  };

  return randomReader;
};
