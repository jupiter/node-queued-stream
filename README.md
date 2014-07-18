node-queued-stream
==================

This transform stream will switch from one queued input stream to the next to provide a continuous output stream. The output stream will only end once a maximum output byte length has been reached or when explicitly ended. This allows for input streams to be queued after this stream has been piped, after output has started or even after all the previously queued up streams have completed.

## Installation

``` bash
npm install queued-stream
```

## Usage

``` javascript
var QueuedStream = require('queued-stream');
var fs = require('fs');

var queuedStream = new QueuedStream({ maxBytes: 20000 });

queuedStream.pipe(fs.createWriteStream('combined.txt'));

// Add input streams when ready
combinedStream.append(fs.createReadStream('file1.txt'))

// Add more input streams later
setTimeout(function(){
  queuedStream.append(fs.createReadStream('file2.txt'));
}, 1000);
```

To end after all items in the queue had been processed, just append an empty value to the queued stream.

``` javascript
queuedStream.append(fs.createReadStream('file3.txt')).append(null);
```

## API

### QueuedStream([options])

- **maxBytes** ends the output stream after so many bytes have been output (discards the rest)

### queuedStream.append(stream, [expectedBytes])

Should read from this stream next. It will switch to the next stream in the queue after **expectedBytes** have been read, or if this stream has ended.

If stream is `null`, output will end.

### queuedStream.destroy()

Immediately unpipes from active stream, where active, and ends the output stream.
