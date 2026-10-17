import { createRequire } from "node:module";
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/pend/index.js
var require_pend = __commonJS(function(exports, module) {
  module.exports = Pend;
  function Pend() {
    this.pending = 0;
    this.max = Infinity;
    this.listeners = [];
    this.waiting = [];
    this.error = null;
  }
  Pend.prototype.go = function(fn) {
    if (this.pending < this.max) {
      pendGo(this, fn);
    } else {
      this.waiting.push(fn);
    }
  };
  Pend.prototype.wait = function(cb) {
    if (this.pending === 0) {
      cb(this.error);
    } else {
      this.listeners.push(cb);
    }
  };
  Pend.prototype.hold = function() {
    return pendHold(this);
  };
  function pendHold(self) {
    self.pending += 1;
    var called = false;
    return onCb;
    function onCb(err) {
      if (called)
        throw new Error("callback called twice");
      called = true;
      self.error = self.error || err;
      self.pending -= 1;
      if (self.waiting.length > 0 && self.pending < self.max) {
        pendGo(self, self.waiting.shift());
      } else if (self.pending === 0) {
        var listeners = self.listeners;
        self.listeners = [];
        listeners.forEach(cbListener);
      }
    }
    function cbListener(listener) {
      listener(self.error);
    }
  }
  function pendGo(self, fn) {
    fn(pendHold(self));
  }
});

// node_modules/yauzl/fd-slicer.js
var require_fd_slicer = __commonJS(function(exports) {
  var fs = __require("fs");
  var util = __require("util");
  var stream = __require("stream");
  var Readable = stream.Readable;
  var PassThrough = stream.PassThrough;
  var Pend = require_pend();
  var EventEmitter = __require("events").EventEmitter;
  exports.BufferSlicer = BufferSlicer;
  exports.FdSlicer = FdSlicer;
  util.inherits(FdSlicer, EventEmitter);
  function FdSlicer(fd) {
    EventEmitter.call(this);
    this.fd = fd;
    this.pend = new Pend;
    this.pend.max = 1;
    this.refCount = 0;
  }
  FdSlicer.prototype.read = function(buffer, offset, length, position, callback) {
    var self = this;
    self.pend.go(function(cb) {
      fs.read(self.fd, buffer, offset, length, position, function(err, bytesRead, buffer) {
        cb();
        callback(err, bytesRead, buffer);
      });
    });
  };
  FdSlicer.prototype.createReadStream = function(options2) {
    return new ReadStream(this, options2);
  };
  FdSlicer.prototype.ref = function() {
    this.refCount += 1;
  };
  FdSlicer.prototype.unref = function() {
    var self = this;
    self.refCount -= 1;
    if (self.refCount < 0)
      throw new Error("invalid unref");
    if (self.refCount > 0)
      return;
    fs.close(self.fd, onCloseDone);
    function onCloseDone(err) {
      if (err) {
        self.emit("error", err);
      } else {
        self.emit("close");
      }
    }
  };
  util.inherits(ReadStream, Readable);
  function ReadStream(context, options2) {
    options2 = options2 || {};
    Readable.call(this, options2);
    this.context = context;
    this.context.ref();
    this.start = options2.start || 0;
    this.endOffset = options2.end;
    this.pos = this.start;
  }
  ReadStream.prototype._read = function(n) {
    var self = this;
    var toRead = Math.min(self._readableState.highWaterMark, n);
    if (self.endOffset != null) {
      toRead = Math.min(toRead, self.endOffset - self.pos);
    }
    if (toRead <= 0) {
      self.push(null);
      this._cleanup();
      return;
    }
    self.context.pend.go(function(cb) {
      var buffer = Buffer.allocUnsafe(toRead);
      fs.read(self.context.fd, buffer, 0, toRead, self.pos, function(err, bytesRead) {
        if (err) {
          self.destroy(err);
        } else if (bytesRead === 0) {
          self.push(null);
          self._cleanup();
        } else {
          self.pos += bytesRead;
          self.push(buffer.slice(0, bytesRead));
        }
        cb();
      });
    });
  };
  ReadStream.prototype._destroy = function(err, cb) {
    this._cleanup();
    cb(err);
  };
  ReadStream.prototype._cleanup = function() {
    if (this.context != null) {
      this.context.unref();
      this.context = null;
    }
  };
  util.inherits(BufferSlicer, EventEmitter);
  function BufferSlicer(buffer) {
    EventEmitter.call(this);
    this.refCount = 0;
    this.buffer = buffer;
  }
  BufferSlicer.prototype.read = function(buffer, offset, length, position, callback) {
    if (!(0 <= offset && offset <= buffer.length))
      throw new RangeError("offset outside buffer: 0 <= " + offset + " <= " + buffer.length);
    if (position < 0)
      throw new RangeError("position is negative: " + position);
    if (offset + length > buffer.length) {
      length = buffer.length - offset;
    }
    if (position + length > this.buffer.length) {
      length = this.buffer.length - position;
    }
    if (length <= 0) {
      setImmediate(function() {
        callback(null, 0);
      });
      return;
    }
    this.buffer.copy(buffer, offset, position, position + length);
    setImmediate(function() {
      callback(null, length);
    });
  };
  BufferSlicer.prototype.createReadStream = function(options2) {
    options2 = options2 || {};
    var readStream = new PassThrough(options2);
    readStream.start = options2.start || 0;
    readStream.endOffset = options2.end;
    readStream.pos = readStream.endOffset || this.buffer.length;
    var entireSlice = this.buffer.slice(readStream.start, readStream.pos);
    var maxChunkSize = 65536;
    var offset = 0;
    while (true) {
      var nextOffset = offset + maxChunkSize;
      if (nextOffset >= entireSlice.length) {
        if (offset < entireSlice.length) {
          readStream.write(entireSlice.slice(offset, entireSlice.length));
        }
        break;
      }
      readStream.write(entireSlice.slice(offset, nextOffset));
      offset = nextOffset;
    }
    readStream.end();
    return readStream;
  };
  BufferSlicer.prototype.ref = function() {
    this.refCount += 1;
  };
  BufferSlicer.prototype.unref = function() {
    this.refCount -= 1;
    if (this.refCount < 0) {
      throw new Error("invalid unref");
    }
  };
});

// node_modules/yauzl/crc32.js
var require_crc32 = __commonJS(function(exports, module) {
  var CRC_TABLE = new Int32Array([
    0,
    1996959894,
    3993919788,
    2567524794,
    124634137,
    1886057615,
    3915621685,
    2657392035,
    249268274,
    2044508324,
    3772115230,
    2547177864,
    162941995,
    2125561021,
    3887607047,
    2428444049,
    498536548,
    1789927666,
    4089016648,
    2227061214,
    450548861,
    1843258603,
    4107580753,
    2211677639,
    325883990,
    1684777152,
    4251122042,
    2321926636,
    335633487,
    1661365465,
    4195302755,
    2366115317,
    997073096,
    1281953886,
    3579855332,
    2724688242,
    1006888145,
    1258607687,
    3524101629,
    2768942443,
    901097722,
    1119000684,
    3686517206,
    2898065728,
    853044451,
    1172266101,
    3705015759,
    2882616665,
    651767980,
    1373503546,
    3369554304,
    3218104598,
    565507253,
    1454621731,
    3485111705,
    3099436303,
    671266974,
    1594198024,
    3322730930,
    2970347812,
    795835527,
    1483230225,
    3244367275,
    3060149565,
    1994146192,
    31158534,
    2563907772,
    4023717930,
    1907459465,
    112637215,
    2680153253,
    3904427059,
    2013776290,
    251722036,
    2517215374,
    3775830040,
    2137656763,
    141376813,
    2439277719,
    3865271297,
    1802195444,
    476864866,
    2238001368,
    4066508878,
    1812370925,
    453092731,
    2181625025,
    4111451223,
    1706088902,
    314042704,
    2344532202,
    4240017532,
    1658658271,
    366619977,
    2362670323,
    4224994405,
    1303535960,
    984961486,
    2747007092,
    3569037538,
    1256170817,
    1037604311,
    2765210733,
    3554079995,
    1131014506,
    879679996,
    2909243462,
    3663771856,
    1141124467,
    855842277,
    2852801631,
    3708648649,
    1342533948,
    654459306,
    3188396048,
    3373015174,
    1466479909,
    544179635,
    3110523913,
    3462522015,
    1591671054,
    702138776,
    2966460450,
    3352799412,
    1504918807,
    783551873,
    3082640443,
    3233442989,
    3988292384,
    2596254646,
    62317068,
    1957810842,
    3939845945,
    2647816111,
    81470997,
    1943803523,
    3814918930,
    2489596804,
    225274430,
    2053790376,
    3826175755,
    2466906013,
    167816743,
    2097651377,
    4027552580,
    2265490386,
    503444072,
    1762050814,
    4150417245,
    2154129355,
    426522225,
    1852507879,
    4275313526,
    2312317920,
    282753626,
    1742555852,
    4189708143,
    2394877945,
    397917763,
    1622183637,
    3604390888,
    2714866558,
    953729732,
    1340076626,
    3518719985,
    2797360999,
    1068828381,
    1219638859,
    3624741850,
    2936675148,
    906185462,
    1090812512,
    3747672003,
    2825379669,
    829329135,
    1181335161,
    3412177804,
    3160834842,
    628085408,
    1382605366,
    3423369109,
    3138078467,
    570562233,
    1426400815,
    3317316542,
    2998733608,
    733239954,
    1555261956,
    3268935591,
    3050360625,
    752459403,
    1541320221,
    2607071920,
    3965973030,
    1969922972,
    40735498,
    2617837225,
    3943577151,
    1913087877,
    83908371,
    2512341634,
    3803740692,
    2075208622,
    213261112,
    2463272603,
    3855990285,
    2094854071,
    198958881,
    2262029012,
    4057260610,
    1759359992,
    534414190,
    2176718541,
    4139329115,
    1873836001,
    414664567,
    2282248934,
    4279200368,
    1711684554,
    285281116,
    2405801727,
    4167216745,
    1634467795,
    376229701,
    2685067896,
    3608007406,
    1308918612,
    956543938,
    2808555105,
    3495958263,
    1231636301,
    1047427035,
    2932959818,
    3654703836,
    1088359270,
    936918000,
    2847714899,
    3736837829,
    1202900863,
    817233897,
    3183342108,
    3401237130,
    1404277552,
    615818150,
    3134207493,
    3453421203,
    1423857449,
    601450431,
    3009837614,
    3294710456,
    1567103746,
    711928724,
    3020668471,
    3272380065,
    1510334235,
    755167117
  ]);
  function crc32(buf) {
    let crc = -1;
    for (let x of buf) {
      crc = CRC_TABLE[(crc ^ x) & 255] ^ crc >>> 8;
    }
    return (crc ^ -1) >>> 0;
  }
  module.exports = crc32;
});

// node_modules/yauzl/index.js
var fs = __require("fs");
var zlib = __require("zlib");
var fd_slicer = require_fd_slicer();
var util = __require("util");
var EventEmitter = __require("events").EventEmitter;
var Transform = __require("stream").Transform;
var PassThrough = __require("stream").PassThrough;
var Writable = __require("stream").Writable;
var crc32 = typeof zlib.crc32 === "function" ? zlib.crc32 : require_crc32();
var $open = open;
var $fromFd = fromFd;
var $fromBuffer = fromBuffer;
var $fromRandomAccessReader = fromRandomAccessReader;
var $openPromise = openPromise;
var $fromFdPromise = fromFdPromise;
var $fromBufferPromise = fromBufferPromise;
var $fromRandomAccessReaderPromise = fromRandomAccessReaderPromise;
var $dosDateTimeToDate = dosDateTimeToDate;
var $getFileNameLowLevel = getFileNameLowLevel;
var $validateFileName = validateFileName;
var $parseExtraFields = parseExtraFields;
var $ZipFile = ZipFile;
var $Entry = Entry;
var $LocalFileHeader = LocalFileHeader;
var $RandomAccessReader = RandomAccessReader;
function openPromise(path, options2) {
  return new Promise((resolve, reject) => {
    open(path, { ...options2, lazyEntries: true }, function(err, zipfile) {
      if (err)
        return reject(err);
      resolve(zipfile);
    });
  });
}
function fromFdPromise(fd, options2) {
  return new Promise((resolve, reject) => {
    fromFd(fd, { ...options2, lazyEntries: true }, function(err, zipfile) {
      if (err)
        return reject(err);
      resolve(zipfile);
    });
  });
}
function fromBufferPromise(buffer, options2) {
  return new Promise((resolve, reject) => {
    fromBuffer(buffer, { ...options2, lazyEntries: true }, function(err, zipfile) {
      if (err)
        return reject(err);
      resolve(zipfile);
    });
  });
}
function fromRandomAccessReaderPromise(reader, totalSize, options2) {
  return new Promise((resolve, reject) => {
    fromRandomAccessReader(reader, totalSize, { ...options2, lazyEntries: true }, function(err, zipfile) {
      if (err)
        return reject(err);
      resolve(zipfile);
    });
  });
}
function open(path, options2, callback) {
  if (typeof options2 === "function") {
    callback = options2;
    options2 = null;
  }
  if (options2 == null)
    options2 = {};
  if (options2.autoClose == null)
    options2.autoClose = true;
  if (options2.lazyEntries == null)
    options2.lazyEntries = false;
  if (options2.decodeStrings == null)
    options2.decodeStrings = true;
  if (options2.validateEntrySizes == null)
    options2.validateEntrySizes = true;
  if (options2.strictFileNames == null)
    options2.strictFileNames = false;
  if (callback == null)
    callback = defaultCallback;
  fs.open(path, "r", function(err, fd) {
    if (err)
      return callback(err);
    fromFd(fd, options2, function(err, zipfile) {
      if (err)
        fs.close(fd, defaultCallback);
      callback(err, zipfile);
    });
  });
}
function fromFd(fd, options2, callback) {
  if (typeof options2 === "function") {
    callback = options2;
    options2 = null;
  }
  if (options2 == null)
    options2 = {};
  if (options2.autoClose == null)
    options2.autoClose = false;
  if (options2.lazyEntries == null)
    options2.lazyEntries = false;
  if (options2.decodeStrings == null)
    options2.decodeStrings = true;
  if (options2.validateEntrySizes == null)
    options2.validateEntrySizes = true;
  if (options2.strictFileNames == null)
    options2.strictFileNames = false;
  if (callback == null)
    callback = defaultCallback;
  fs.fstat(fd, function(err, stats) {
    if (err)
      return callback(err);
    var reader = new fd_slicer.FdSlicer(fd);
    fromRandomAccessReader(reader, stats.size, options2, callback);
  });
}
function fromBuffer(buffer, options2, callback) {
  if (typeof options2 === "function") {
    callback = options2;
    options2 = null;
  }
  if (options2 == null)
    options2 = {};
  options2.autoClose = false;
  if (options2.lazyEntries == null)
    options2.lazyEntries = false;
  if (options2.decodeStrings == null)
    options2.decodeStrings = true;
  if (options2.validateEntrySizes == null)
    options2.validateEntrySizes = true;
  if (options2.strictFileNames == null)
    options2.strictFileNames = false;
  var reader = new fd_slicer.BufferSlicer(buffer);
  fromRandomAccessReader(reader, buffer.length, options2, callback);
}
function fromRandomAccessReader(reader, totalSize, options2, callback) {
  if (typeof options2 === "function") {
    callback = options2;
    options2 = null;
  }
  if (options2 == null)
    options2 = {};
  if (options2.autoClose == null)
    options2.autoClose = true;
  if (options2.lazyEntries == null)
    options2.lazyEntries = false;
  if (options2.decodeStrings == null)
    options2.decodeStrings = true;
  var decodeStrings = !!options2.decodeStrings;
  if (options2.validateEntrySizes == null)
    options2.validateEntrySizes = true;
  if (options2.strictFileNames == null)
    options2.strictFileNames = false;
  if (callback == null)
    callback = defaultCallback;
  if (typeof totalSize !== "number")
    throw new Error("expected totalSize parameter to be a number");
  if (totalSize > Number.MAX_SAFE_INTEGER) {
    throw new Error("zip file too large. only file sizes up to 2^52 are supported due to JavaScript's Number type being an IEEE 754 double.");
  }
  reader.ref();
  var eocdrWithoutCommentSize = 22;
  var zip64EocdlSize = 20;
  var maxCommentSize = 65535;
  var bufferSize = Math.min(zip64EocdlSize + eocdrWithoutCommentSize + maxCommentSize, totalSize);
  var buffer = newBuffer(bufferSize);
  var bufferReadStart = totalSize - buffer.length;
  readAndAssertNoEof(reader, buffer, 0, bufferSize, bufferReadStart, function(err) {
    if (err)
      return callback(err);
    for (var i = bufferSize - eocdrWithoutCommentSize;i >= 0; i -= 1) {
      if (buffer.readUInt32LE(i) !== 101010256)
        continue;
      var eocdrBuffer = buffer.subarray(i);
      var diskNumber = eocdrBuffer.readUInt16LE(4);
      var entryCount = eocdrBuffer.readUInt16LE(10);
      var centralDirectoryOffset = eocdrBuffer.readUInt32LE(16);
      var commentLength = eocdrBuffer.readUInt16LE(20);
      var expectedCommentLength = eocdrBuffer.length - eocdrWithoutCommentSize;
      if (commentLength !== expectedCommentLength) {
        return callback(new Error("Invalid comment length. Expected: " + expectedCommentLength + ". Found: " + commentLength + ". Are there extra bytes at the end of the file? Or is the end of central dir signature `PK☺☻` in the comment?"));
      }
      var comment = decodeStrings ? decodeBuffer(eocdrBuffer.subarray(22), false) : eocdrBuffer.subarray(22);
      if (i - zip64EocdlSize >= 0 && buffer.readUInt32LE(i - zip64EocdlSize) === 117853008) {
        var zip64EocdlBuffer = buffer.subarray(i - zip64EocdlSize, i - zip64EocdlSize + zip64EocdlSize);
        var zip64EocdrOffset = readUInt64LE(zip64EocdlBuffer, 8);
        var zip64EocdrBuffer = newBuffer(56);
        return readAndAssertNoEof(reader, zip64EocdrBuffer, 0, zip64EocdrBuffer.length, zip64EocdrOffset, function(err) {
          if (err)
            return callback(err);
          if (zip64EocdrBuffer.readUInt32LE(0) !== 101075792) {
            return callback(new Error("invalid zip64 end of central directory record signature"));
          }
          diskNumber = zip64EocdrBuffer.readUInt32LE(16);
          if (diskNumber !== 0) {
            return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
          }
          entryCount = readUInt64LE(zip64EocdrBuffer, 32);
          centralDirectoryOffset = readUInt64LE(zip64EocdrBuffer, 48);
          return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options2.autoClose, options2.lazyEntries, decodeStrings, options2.validateEntrySizes, options2.strictFileNames));
        });
      }
      if (diskNumber !== 0) {
        return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
      }
      return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options2.autoClose, options2.lazyEntries, decodeStrings, options2.validateEntrySizes, options2.strictFileNames));
    }
    callback(new Error("End of central directory record signature not found. Either not a zip file, or file is truncated."));
  });
}
util.inherits(ZipFile, EventEmitter);
function ZipFile(reader, centralDirectoryOffset, fileSize, entryCount, comment, autoClose, lazyEntries, decodeStrings, validateEntrySizes, strictFileNames) {
  var self = this;
  EventEmitter.call(self);
  self.reader = reader;
  self.reader.on("error", function(err) {
    emitError(self, err);
  });
  self.reader.once("close", function() {
    self.emit("close");
  });
  self.readEntryCursor = centralDirectoryOffset;
  self.fileSize = fileSize;
  self.entryCount = entryCount;
  self.comment = comment;
  self.entriesRead = 0;
  self.autoClose = !!autoClose;
  self.lazyEntries = !!lazyEntries;
  self.decodeStrings = !!decodeStrings;
  self.validateEntrySizes = !!validateEntrySizes;
  self.strictFileNames = !!strictFileNames;
  self.isOpen = true;
  self.emittedError = false;
  self.hasEachEntryBeenCalled = false;
  if (!self.lazyEntries)
    self._readEntry();
}
ZipFile.prototype.close = function() {
  if (!this.isOpen)
    return;
  this.isOpen = false;
  this.reader.unref();
};
function emitErrorAndAutoClose(self, err) {
  if (self.autoClose)
    self.close();
  emitError(self, err);
}
function emitError(self, err) {
  if (self.emittedError)
    return;
  self.emittedError = true;
  self.emit("error", err);
}
ZipFile.prototype.readEntry = function() {
  if (!this.lazyEntries)
    throw new Error("readEntry() called without lazyEntries:true");
  this._readEntry();
};
ZipFile.prototype._readEntry = function() {
  var self = this;
  if (self.entryCount === self.entriesRead) {
    setImmediate(function() {
      if (self.autoClose)
        self.close();
      if (self.emittedError)
        return;
      self.emit("end");
    });
    return;
  }
  if (self.emittedError)
    return;
  var buffer = newBuffer(46);
  readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err) {
    if (err)
      return emitErrorAndAutoClose(self, err);
    if (self.emittedError)
      return;
    var entry = new Entry;
    var signature = buffer.readUInt32LE(0);
    if (signature !== 33639248)
      return emitErrorAndAutoClose(self, new Error("invalid central directory file header signature: 0x" + signature.toString(16)));
    entry.versionMadeBy = buffer.readUInt16LE(4);
    entry.versionNeededToExtract = buffer.readUInt16LE(6);
    entry.generalPurposeBitFlag = buffer.readUInt16LE(8);
    entry.compressionMethod = buffer.readUInt16LE(10);
    entry.lastModFileTime = buffer.readUInt16LE(12);
    entry.lastModFileDate = buffer.readUInt16LE(14);
    entry.crc32 = buffer.readUInt32LE(16);
    entry.compressedSize = buffer.readUInt32LE(20);
    entry.uncompressedSize = buffer.readUInt32LE(24);
    entry.fileNameLength = buffer.readUInt16LE(28);
    entry.extraFieldLength = buffer.readUInt16LE(30);
    entry.fileCommentLength = buffer.readUInt16LE(32);
    entry.internalFileAttributes = buffer.readUInt16LE(36);
    entry.externalFileAttributes = buffer.readUInt32LE(38);
    entry.relativeOffsetOfLocalHeader = buffer.readUInt32LE(42);
    if (entry.generalPurposeBitFlag & 64)
      return emitErrorAndAutoClose(self, new Error("strong encryption is not supported"));
    self.readEntryCursor += 46;
    buffer = newBuffer(entry.fileNameLength + entry.extraFieldLength + entry.fileCommentLength);
    readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err) {
      if (err)
        return emitErrorAndAutoClose(self, err);
      if (self.emittedError)
        return;
      entry.fileNameRaw = buffer.subarray(0, entry.fileNameLength);
      var fileCommentStart = entry.fileNameLength + entry.extraFieldLength;
      entry.extraFieldRaw = buffer.subarray(entry.fileNameLength, fileCommentStart);
      entry.fileCommentRaw = buffer.subarray(fileCommentStart, fileCommentStart + entry.fileCommentLength);
      try {
        entry.extraFields = parseExtraFields(entry.extraFieldRaw);
      } catch (err) {
        return emitErrorAndAutoClose(self, err);
      }
      if (self.decodeStrings) {
        var isUtf8 = (entry.generalPurposeBitFlag & 2048) !== 0;
        entry.fileComment = decodeBuffer(entry.fileCommentRaw, isUtf8);
        entry.fileName = getFileNameLowLevel(entry.generalPurposeBitFlag, entry.fileNameRaw, entry.extraFields, self.strictFileNames);
        var errorMessage = validateFileName(entry.fileName);
        if (errorMessage != null)
          return emitErrorAndAutoClose(self, new Error(errorMessage));
      } else {
        entry.fileComment = entry.fileCommentRaw;
        entry.fileName = entry.fileNameRaw;
      }
      entry.comment = entry.fileComment;
      self.readEntryCursor += buffer.length;
      self.entriesRead += 1;
      for (var i = 0;i < entry.extraFields.length; i++) {
        var extraField = entry.extraFields[i];
        if (extraField.id !== 1)
          continue;
        var zip64EiefBuffer = extraField.data;
        var index = 0;
        if (entry.uncompressedSize === 4294967295) {
          if (index + 8 > zip64EiefBuffer.length) {
            return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include uncompressed size"));
          }
          entry.uncompressedSize = readUInt64LE(zip64EiefBuffer, index);
          index += 8;
        }
        if (entry.compressedSize === 4294967295) {
          if (index + 8 > zip64EiefBuffer.length) {
            return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include compressed size"));
          }
          entry.compressedSize = readUInt64LE(zip64EiefBuffer, index);
          index += 8;
        }
        if (entry.relativeOffsetOfLocalHeader === 4294967295) {
          if (index + 8 > zip64EiefBuffer.length) {
            return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include relative header offset"));
          }
          entry.relativeOffsetOfLocalHeader = readUInt64LE(zip64EiefBuffer, index);
          index += 8;
        }
        break;
      }
      if (self.validateEntrySizes && entry.compressionMethod === 0) {
        var expectedCompressedSize = entry.uncompressedSize;
        if (entry.isEncrypted()) {
          expectedCompressedSize += 12;
        }
        if (entry.compressedSize !== expectedCompressedSize) {
          var msg = "compressed/uncompressed size mismatch for stored file: " + entry.compressedSize + " != " + entry.uncompressedSize;
          return emitErrorAndAutoClose(self, new Error(msg));
        }
      }
      self.emit("entry", entry);
      if (!self.lazyEntries)
        self._readEntry();
    });
  });
};
ZipFile.prototype.eachEntry = function() {
  const self = this;
  if (!self.lazyEntries)
    throw new Error("eachEntry() requires lazyEntries: true");
  if (self.hasEachEntryBeenCalled)
    throw new Error("eachEntry() must only be called once per ZipFile");
  self.hasEachEntryBeenCalled = true;
  let pendingResolveReject = null;
  self.on("entry", onEntry);
  self.on("end", onEnd);
  self.on("error", onError);
  function cleanup() {
    self.removeListener("entry", onEntry);
    self.removeListener("end", onEnd);
    self.removeListener("error", onError);
    if (self.autoClose)
      self.close();
  }
  function onEntry(entry) {
    let { resolve } = pendingResolveReject;
    pendingResolveReject = null;
    resolve({ value: entry });
  }
  function onEnd() {
    let { resolve } = pendingResolveReject;
    pendingResolveReject = null;
    cleanup();
    resolve({ done: true });
  }
  function onError(err) {
    let { reject } = pendingResolveReject;
    pendingResolveReject = null;
    cleanup();
    reject(err);
  }
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      const promise = new Promise((resolve, reject) => {
        if (pendingResolveReject != null)
          throw new Error("next() called before previous Promise was resolved.");
        pendingResolveReject = { resolve, reject };
      });
      self.readEntry();
      return promise;
    },
    return(value) {
      cleanup();
      return Promise.resolve({ done: true, value });
    },
    throw(value) {
      cleanup();
      return Promise.reject(value);
    }
  };
};
ZipFile.prototype.openReadStream = function(entry, options2, callback) {
  var self = this;
  var relativeStart = 0;
  var relativeEnd = entry.compressedSize;
  if (callback == null) {
    callback = options2;
    options2 = null;
  }
  if (options2 == null) {
    options2 = {};
  } else {
    if (options2.decodeFileData === false) {
      if (options2.decrypt != null) {
        throw new Error("cannot use options.decrypt when options.decodeFileData === false");
      }
      if (options2.decompress != null) {
        throw new Error("cannot use options.decompress when options.decodeFileData === false");
      }
    } else {
      if (options2.decrypt != null) {
        if (!entry.isEncrypted()) {
          throw new Error("options.decrypt can only be specified for encrypted entries. See also option decodeFileData.");
        }
        if (options2.decrypt !== false)
          throw new Error("invalid options.decrypt value: " + options2.decrypt);
        if (entry.isCompressed()) {
          if (options2.decompress !== false)
            throw new Error("entry is encrypted and compressed, and options.decompress !== false. See also option decodeFileData.");
        }
      }
      if (options2.decompress != null) {
        if (!entry.isCompressed()) {
          throw new Error("options.decompress can only be specified for compressed entries. See also option decodeFileData.");
        }
        if (!(options2.decompress === false || options2.decompress === true)) {
          throw new Error("invalid options.decompress value: " + options2.decompress);
        }
        decompress = options2.decompress;
      }
    }
    if (options2.start != null) {
      relativeStart = options2.start;
      if (relativeStart < 0)
        throw new Error("options.start < 0");
      if (relativeStart > entry.compressedSize)
        throw new Error("options.start > entry.compressedSize");
    }
    if (options2.end != null) {
      relativeEnd = options2.end;
      if (relativeEnd < 0)
        throw new Error("options.end < 0");
      if (relativeEnd > entry.compressedSize)
        throw new Error("options.end > entry.compressedSize");
      if (relativeEnd < relativeStart)
        throw new Error("options.end < options.start");
    }
  }
  var rawMode = options2.decodeFileData === false || (entry.compressionMethod === 0 || entry.compressionMethod === 8 && options2.decompress === false) && (!entry.isEncrypted() || options2.decrypt === false);
  if (options2.start != null || options2.end != null) {
    if (!rawMode)
      throw new Error("start/end range require options.decodeFileData === false for non-trivial encoded entries.");
  }
  if (!self.isOpen)
    return callback(new Error("closed"));
  if (entry.isEncrypted() && !rawMode) {
    if (options2.decrypt !== false)
      return callback(new Error("entry is encrypted, and options.decodeFileData !== false"));
  }
  var decompress;
  if (rawMode) {
    decompress = false;
  } else if (entry.compressionMethod === 8) {
    decompress = options2.decodeFileData !== true;
  } else {
    return callback(new Error("unsupported compression method: " + entry.compressionMethod));
  }
  self.readLocalFileHeader(entry, { minimal: true }, function(err, localFileHeader) {
    if (err)
      return callback(err);
    self.openReadStreamLowLevel(localFileHeader.fileDataStart, entry.compressedSize, relativeStart, relativeEnd, decompress, entry.uncompressedSize, callback);
  });
};
ZipFile.prototype.openReadStreamLowLevel = function(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize, callback) {
  var self = this;
  var fileDataEnd = fileDataStart + compressedSize;
  var readStream = self.reader.createReadStream({
    start: fileDataStart + relativeStart,
    end: fileDataStart + relativeEnd
  });
  var endpointStream = readStream;
  if (decompress) {
    var destroyed = false;
    var inflateFilter = zlib.createInflateRaw();
    readStream.on("error", function(err) {
      setImmediate(function() {
        if (!destroyed)
          inflateFilter.emit("error", err);
      });
    });
    readStream.pipe(inflateFilter);
    if (self.validateEntrySizes) {
      endpointStream = new AssertByteCountStream(uncompressedSize);
      inflateFilter.on("error", function(err) {
        setImmediate(function() {
          if (!destroyed)
            endpointStream.emit("error", err);
        });
      });
      inflateFilter.pipe(endpointStream);
    } else {
      endpointStream = inflateFilter;
    }
    installDestroyFn(endpointStream, function() {
      destroyed = true;
      if (inflateFilter !== endpointStream)
        inflateFilter.unpipe(endpointStream);
      readStream.unpipe(inflateFilter);
      readStream.destroy();
    });
  }
  callback(null, endpointStream);
};
ZipFile.prototype.readLocalFileHeader = function(entry, options2, callback) {
  var self = this;
  if (callback == null) {
    callback = options2;
    options2 = null;
  }
  if (options2 == null)
    options2 = {};
  self.reader.ref();
  var buffer = newBuffer(30);
  readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader, function(err) {
    try {
      if (err)
        return callback(err);
      var signature = buffer.readUInt32LE(0);
      if (signature !== 67324752) {
        return callback(new Error("invalid local file header signature: 0x" + signature.toString(16)));
      }
      var fileNameLength = buffer.readUInt16LE(26);
      var extraFieldLength = buffer.readUInt16LE(28);
      var fileDataStart = entry.relativeOffsetOfLocalHeader + 30 + fileNameLength + extraFieldLength;
      if (fileDataStart + entry.compressedSize > self.fileSize) {
        return callback(new Error("file data overflows file bounds: " + fileDataStart + " + " + entry.compressedSize + " > " + self.fileSize));
      }
      if (options2.minimal) {
        return callback(null, { fileDataStart });
      }
      var localFileHeader = new LocalFileHeader;
      localFileHeader.fileDataStart = fileDataStart;
      localFileHeader.versionNeededToExtract = buffer.readUInt16LE(4);
      localFileHeader.generalPurposeBitFlag = buffer.readUInt16LE(6);
      localFileHeader.compressionMethod = buffer.readUInt16LE(8);
      localFileHeader.lastModFileTime = buffer.readUInt16LE(10);
      localFileHeader.lastModFileDate = buffer.readUInt16LE(12);
      localFileHeader.crc32 = buffer.readUInt32LE(14);
      localFileHeader.compressedSize = buffer.readUInt32LE(18);
      localFileHeader.uncompressedSize = buffer.readUInt32LE(22);
      localFileHeader.fileNameLength = fileNameLength;
      localFileHeader.extraFieldLength = extraFieldLength;
      buffer = newBuffer(fileNameLength + extraFieldLength);
      self.reader.ref();
      readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader + 30, function(err) {
        try {
          if (err)
            return callback(err);
          localFileHeader.fileName = buffer.subarray(0, fileNameLength);
          localFileHeader.extraField = buffer.subarray(fileNameLength);
          return callback(null, localFileHeader);
        } finally {
          self.reader.unref();
        }
      });
    } finally {
      self.reader.unref();
    }
  });
};
ZipFile.prototype.openReadStreamPromise = function(entry, options2) {
  return new Promise((resolve, reject) => {
    this.openReadStream(entry, options2, function(err, readStream) {
      if (err)
        return reject(err);
      resolve(readStream);
    });
  });
};
ZipFile.prototype.openReadStreamLowLevelPromise = function(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize) {
  return new Promise((resolve, reject) => {
    this.openReadStream(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize, function(err, readStream) {
      if (err)
        return reject(err);
      resolve(readStream);
    });
  });
};
ZipFile.prototype.readLocalFileHeaderPromise = function(entry, options2) {
  return new Promise((resolve, reject) => {
    this.readLocalFileHeader(entry, options2, function(err, localFileHeader) {
      if (err)
        return reject(err);
      resolve(localFileHeader);
    });
  });
};
function Entry() {}
Entry.prototype.getLastModDate = function(options2) {
  if (options2 == null)
    options2 = {};
  if (!options2.forceDosFormat) {
    for (var i = 0;i < this.extraFields.length; i++) {
      var extraField = this.extraFields[i];
      if (extraField.id === 21589) {
        var data = extraField.data;
        if (data.length < 5)
          continue;
        var flags = data[0];
        var HAS_MTIME = 1;
        if (!(flags & HAS_MTIME))
          continue;
        var posixTimestamp = data.readInt32LE(1);
        return new Date(posixTimestamp * 1000);
      } else if (extraField.id === 10) {
        var data = extraField.data;
        if (data.length !== 32)
          continue;
        if (data.readUInt16LE(4) !== 1)
          continue;
        if (data.readUInt16LE(6) !== 24)
          continue;
        var hundredNanoSecondsSince1601 = data.readUInt32LE(8) + 4294967296 * data.readInt32LE(12);
        var millisecondsSince1970 = hundredNanoSecondsSince1601 / 1e4 - 11644473600000;
        return new Date(millisecondsSince1970);
      }
    }
  }
  return dosDateTimeToDate(this.lastModFileDate, this.lastModFileTime, options2.timezone);
};
Entry.prototype.canDecodeFileData = function() {
  return !this.isEncrypted() && (this.compressionMethod === 0 || this.compressionMethod === 8);
};
Entry.prototype.isEncrypted = function() {
  return (this.generalPurposeBitFlag & 1) !== 0;
};
Entry.prototype.isCompressed = function() {
  return this.compressionMethod === 8;
};
function LocalFileHeader() {}
function dosDateTimeToDate(date, time, timezone) {
  var day = date & 31;
  var month = (date >> 5 & 15) - 1;
  var year = (date >> 9 & 127) + 1980;
  var millisecond = 0;
  var second = (time & 31) * 2;
  var minute = time >> 5 & 63;
  var hour = time >> 11 & 31;
  if (timezone == null || timezone === "local") {
    return new Date(year, month, day, hour, minute, second, millisecond);
  } else if (timezone === "UTC") {
    return new Date(Date.UTC(year, month, day, hour, minute, second, millisecond));
  } else {
    throw new Error("unrecognized options.timezone: " + options.timezone);
  }
}
function getFileNameLowLevel(generalPurposeBitFlag, fileNameBuffer, extraFields, strictFileNames) {
  var fileName = null;
  for (var i = 0;i < extraFields.length; i++) {
    var extraField = extraFields[i];
    if (extraField.id === 28789) {
      if (extraField.data.length < 6) {
        continue;
      }
      if (extraField.data.readUInt8(0) !== 1) {
        continue;
      }
      var oldNameCrc32 = extraField.data.readUInt32LE(1);
      if (crc32(fileNameBuffer) !== oldNameCrc32) {
        continue;
      }
      fileName = decodeBuffer(extraField.data.subarray(5), true);
      break;
    }
  }
  if (fileName == null) {
    var isUtf8 = (generalPurposeBitFlag & 2048) !== 0;
    fileName = decodeBuffer(fileNameBuffer, isUtf8);
  }
  if (!strictFileNames) {
    fileName = fileName.replace(/\\/g, "/");
  }
  return fileName;
}
function validateFileName(fileName) {
  if (fileName.indexOf("\\") !== -1) {
    return "invalid characters in fileName: " + fileName;
  }
  if (/^[a-zA-Z]:/.test(fileName) || /^\//.test(fileName)) {
    return "absolute path: " + fileName;
  }
  if (fileName.split("/").indexOf("..") !== -1) {
    return "invalid relative path: " + fileName;
  }
  return null;
}
function parseExtraFields(extraFieldBuffer) {
  var extraFields = [];
  var i = 0;
  while (i < extraFieldBuffer.length - 3) {
    var headerId = extraFieldBuffer.readUInt16LE(i + 0);
    var dataSize = extraFieldBuffer.readUInt16LE(i + 2);
    var dataStart = i + 4;
    var dataEnd = dataStart + dataSize;
    if (dataEnd > extraFieldBuffer.length)
      throw new Error("extra field length exceeds extra field buffer size");
    var dataBuffer = extraFieldBuffer.subarray(dataStart, dataEnd);
    extraFields.push({
      id: headerId,
      data: dataBuffer
    });
    i = dataEnd;
  }
  return extraFields;
}
function readAndAssertNoEof(reader, buffer, offset, length, position, callback) {
  if (length === 0) {
    return setImmediate(function() {
      callback(null, newBuffer(0));
    });
  }
  reader.read(buffer, offset, length, position, function(err, bytesRead) {
    if (err)
      return callback(err);
    if (bytesRead < length) {
      return callback(new Error("unexpected EOF"));
    }
    callback();
  });
}
util.inherits(AssertByteCountStream, Transform);
function AssertByteCountStream(byteCount) {
  Transform.call(this);
  this.actualByteCount = 0;
  this.expectedByteCount = byteCount;
}
AssertByteCountStream.prototype._transform = function(chunk, encoding, cb) {
  this.actualByteCount += chunk.length;
  if (this.actualByteCount > this.expectedByteCount) {
    var msg = "too many bytes in the stream. expected " + this.expectedByteCount + ". got at least " + this.actualByteCount;
    return cb(new Error(msg));
  }
  cb(null, chunk);
};
AssertByteCountStream.prototype._flush = function(cb) {
  if (this.actualByteCount < this.expectedByteCount) {
    var msg = "not enough bytes in the stream. expected " + this.expectedByteCount + ". got only " + this.actualByteCount;
    return cb(new Error(msg));
  }
  cb();
};
util.inherits(RandomAccessReader, EventEmitter);
function RandomAccessReader() {
  EventEmitter.call(this);
  this.refCount = 0;
}
RandomAccessReader.prototype.ref = function() {
  this.refCount += 1;
};
RandomAccessReader.prototype.unref = function() {
  var self = this;
  self.refCount -= 1;
  if (self.refCount > 0)
    return;
  if (self.refCount < 0)
    throw new Error("invalid unref");
  self.close(onCloseDone);
  function onCloseDone(err) {
    if (err)
      return self.emit("error", err);
    self.emit("close");
  }
};
RandomAccessReader.prototype.createReadStream = function(options2) {
  if (options2 == null)
    options2 = {};
  var start = options2.start;
  var end = options2.end;
  if (start === end) {
    var emptyStream = new PassThrough;
    setImmediate(function() {
      emptyStream.end();
    });
    return emptyStream;
  }
  var stream = this._readStreamForRange(start, end);
  var destroyed = false;
  var refUnrefFilter = new RefUnrefFilter(this);
  stream.on("error", function(err) {
    setImmediate(function() {
      if (!destroyed)
        refUnrefFilter.emit("error", err);
    });
  });
  installDestroyFn(refUnrefFilter, function() {
    stream.unpipe(refUnrefFilter);
    refUnrefFilter.unref();
    stream.destroy();
  });
  var byteCounter = new AssertByteCountStream(end - start);
  refUnrefFilter.on("error", function(err) {
    setImmediate(function() {
      if (!destroyed)
        byteCounter.emit("error", err);
    });
  });
  installDestroyFn(byteCounter, function() {
    destroyed = true;
    refUnrefFilter.unpipe(byteCounter);
    refUnrefFilter.destroy();
  });
  return stream.pipe(refUnrefFilter).pipe(byteCounter);
};
RandomAccessReader.prototype._readStreamForRange = function(start, end) {
  throw new Error("not implemented");
};
RandomAccessReader.prototype.read = function(buffer, offset, length, position, callback) {
  var readStream = this.createReadStream({ start: position, end: position + length });
  var writeStream = new Writable;
  var written = 0;
  writeStream._write = function(chunk, encoding, cb) {
    chunk.copy(buffer, offset + written, 0, chunk.length);
    written += chunk.length;
    cb();
  };
  writeStream.on("finish", callback);
  readStream.on("error", function(error) {
    callback(error);
  });
  readStream.pipe(writeStream);
};
RandomAccessReader.prototype.close = function(callback) {
  setImmediate(callback);
};
util.inherits(RefUnrefFilter, PassThrough);
function RefUnrefFilter(context) {
  PassThrough.call(this);
  this.context = context;
  this.context.ref();
  this.unreffedYet = false;
}
RefUnrefFilter.prototype._flush = function(cb) {
  this.unref();
  cb();
};
RefUnrefFilter.prototype.unref = function(cb) {
  if (this.unreffedYet)
    return;
  this.unreffedYet = true;
  this.context.unref();
};
var cp437 = "\x00☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
function decodeBuffer(buffer, isUtf8) {
  if (isUtf8) {
    return buffer.toString("utf8");
  } else {
    var result = "";
    for (var i = 0;i < buffer.length; i++) {
      result += cp437[buffer[i]];
    }
    return result;
  }
}
function readUInt64LE(buffer, offset) {
  var lower32 = buffer.readUInt32LE(offset);
  var upper32 = buffer.readUInt32LE(offset + 4);
  return upper32 * 4294967296 + lower32;
}
var newBuffer;
if (typeof Buffer.allocUnsafe === "function") {
  newBuffer = function(len) {
    return Buffer.allocUnsafe(len);
  };
} else {
  newBuffer = function(len) {
    return new Buffer(len);
  };
}
function installDestroyFn(stream, fn) {
  if (typeof stream.destroy === "function") {
    stream._destroy = function(err, cb) {
      fn();
      if (cb != null)
        cb(err);
    };
  } else {
    stream.destroy = fn;
  }
}
function defaultCallback(err) {
  if (err)
    throw err;
}
export {
  $open as open,
  $fromFd as fromFd,
  $fromBuffer as fromBuffer,
  $fromRandomAccessReader as fromRandomAccessReader,
  $openPromise as openPromise,
  $fromFdPromise as fromFdPromise,
  $fromBufferPromise as fromBufferPromise,
  $fromRandomAccessReaderPromise as fromRandomAccessReaderPromise,
  $dosDateTimeToDate as dosDateTimeToDate,
  $getFileNameLowLevel as getFileNameLowLevel,
  $validateFileName as validateFileName,
  $parseExtraFields as parseExtraFields,
  $ZipFile as ZipFile,
  $Entry as Entry,
  $LocalFileHeader as LocalFileHeader,
  $RandomAccessReader as RandomAccessReader
};
