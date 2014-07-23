var fs = require('fs');
var path = require('path');
var assert = require('assert');
var createRandomStream = require('./support/createRandomStream');
var QueuedStream = require('../index');

function createFileStream(filepath) {
  return fs.createWriteStream(filepath || path.join(__dirname, 'support', 'temp'));
}

function getFileSizeAndUnlink(filepath) {
  filepath = filepath || path.join(__dirname, 'support', 'temp');
  var stat;
  try {
    stat = fs.statSync(filepath);
    fs.unlinkSync(filepath);
  } catch (e) {
  }
  return stat.size;
}

describe('QueuedStream', function() {
  describe('with maxBytes', function() {
    beforeEach(function() {
      var qs = this.qs = new QueuedStream({
        maxBytes: 1000
      });
    });

    describe('with one stream', function() {
      describe('and known length', function() {
        it('should stream maxBytes and end', function(done) {
          this.qs.append(createRandomStream({ totalBytes: 1000 }), 1000);
          this.qs.pipe(createFileStream()).on('finish', function(){
            assert.equal(getFileSizeAndUnlink(), 1000);
            done();
          });
        });

        it('should stream only expectedBytes and discard the rest', function(done) {
          this.qs.append(createRandomStream({ totalBytes: 1500 }), 1000);
          this.qs.pipe(createFileStream()).on('finish', function(){
            assert.equal(getFileSizeAndUnlink(), 1000);
            done();
          });
        });

        it('should stream only maxBytes and discard the rest', function(done) {
          this.qs.append(createRandomStream({ totalBytes: 1500 }), 1500);
          this.qs.pipe(createFileStream()).on('finish', function(){
            assert.equal(getFileSizeAndUnlink(), 1000);
            done();
          });
        });
      });

      describe('with unknown length', function() {
        it('should stream maxBytes and end', function(done) {
          this.qs.append(createRandomStream({ totalBytes: 1000 }));
          this.qs.pipe(createFileStream()).on('finish', function(){
            assert.equal(getFileSizeAndUnlink(), 1000);
            done();
          });
        });

        it('should stream only maxBytes and discard the rest', function(done) {
          this.qs.append(createRandomStream({ totalBytes: 1500 }));
          this.qs.pipe(createFileStream()).on('finish', function(){
            assert.equal(getFileSizeAndUnlink(), 1000);
            done();
          });
        });
      });
    });

    describe('with multiple queued streams', function() {
      describe('and known length', function() {
        it('should stream maxBytes and end', function(done) {
          var qs = this.qs;
          var iv = setInterval(function(){
            qs.append(createRandomStream({ totalBytes: 200 }), 200);
          }, 50);

          this.qs.append(createRandomStream({ totalBytes: 200 }), 200);
          this.qs.pipe(createFileStream()).on('finish', function(){
            clearInterval(iv);
            assert.equal(getFileSizeAndUnlink(), 1000);
            done();
          });
        });

        it('should stream only expectedBytes and discard the rest', function(done) {
          var qs = this.qs;
          var count = 1;

          var iv = setInterval(function(){
            count++;
            qs.append(createRandomStream({ totalBytes: 300 }), 200);
          }, 50);

          this.qs.append(createRandomStream({ totalBytes: 200 }), 200);
          this.qs.pipe(createFileStream()).on('finish', function(){
            clearInterval(iv);
            assert.equal(count, 5);
            assert.equal(getFileSizeAndUnlink(), 1000);
            done();
          });
        });

        it('should stream only maxBytes and discard the rest', function(done) {
          var qs = this.qs;
          var count = 1;

          var iv = setInterval(function(){
            count++;
            qs.append(createRandomStream({ totalBytes: 300 }), 300);
          }, 50);

          this.qs.append(createRandomStream({ totalBytes: 300 }), 300);
          this.qs.pipe(createFileStream()).on('finish', function(){
            clearInterval(iv);
            assert.equal(count, 4);
            assert.equal(getFileSizeAndUnlink(), 1000);
            done();
          });
        });
      });

      describe('and unknown length', function() {
        it('should stream maxBytes and end', function(done) {
          var qs = this.qs;
          var iv = setInterval(function(){
            qs.append(createRandomStream({ totalBytes: 200 }));
          }, 50);

          this.qs.append(createRandomStream({ totalBytes: 200 }));
          this.qs.pipe(createFileStream()).on('finish', function(){
            clearInterval(iv);
            assert.equal(getFileSizeAndUnlink(), 1000);
            done();
          });
        });

        it('should stream only maxBytes and discard the rest', function(done) {
          var qs = this.qs;
          var count = 1;

          var iv = setInterval(function(){
            count++;
            qs.append(createRandomStream({ totalBytes: 300 }));
          }, 50);

          this.qs.append(createRandomStream({ totalBytes: 300 }));
          this.qs.pipe(createFileStream()).on('finish', function(){
            clearInterval(iv);
            assert.equal(count, 4);
            assert.equal(getFileSizeAndUnlink(), 1000);
            done();
          });
        });
      });
    });
  });

  describe('without maxBytes', function() {
    beforeEach(function() {
      var qs = this.qs = new QueuedStream();
    });

    it('should stream everything up to null', function(done) {
      var qs = this.qs;
      this.qs.append(createRandomStream({ totalBytes: 1000 }), 999);
      this.qs.append(createRandomStream({ totalBytes: 1500 }), 1001);
      this.qs.append(null);
      this.qs.pipe(createFileStream()).on('finish', function(){
        assert.equal(getFileSizeAndUnlink(), 2000);
        done();
      });
    });
  });

  describe('with an error', function() {
    it('should emit error and stop', function(done) {
        var qs = this.qs = new QueuedStream();

        var error = new Error('etc');
        var err;

        this.qs
        .append(createRandomStream({ totalBytes: 1000 }), 999)
        .append(createRandomStream({ totalBytes: 1001, error: error }), 1001)
        // .append(createRandomStream({ totalBytes: 1000 }), 1000)
        .pipe(createFileStream()).on('finish', function(){
          assert.equal(error, err);
          assert.equal(getFileSizeAndUnlink(), 2000);
          done();
        });

        this.qs.on('error', function(error){
          err = error;
        });
    });
  });
});
