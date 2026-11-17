//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));

'use strict';
/* ================= DATA ================= */
const AX=['Sweet','Salty','Sour','Bitter','Umami','Heat','Rich'], CATS='PSVFCDWXNH';
const CATNAME={P:'meat',S:'seafood',V:'vegetable',F:'fruit',C:'starch',D:'dairy',W:'confection',X:'liquid or paste',N:'nut',H:'aromatic'};
// id,name,verb,hands-on,passive,level,texture,flavour shift,risk,fit by category (PSVFCDWXNH),phrase,flaw,burns
const TECH=[
['raw','Dress raw','dress',2,0,0,'',[0,0,0,0,0,0,0],.02,'0223022223','fresh %','sloppily cut',0],
['sear','Pan-sear','sear',6,0,1,'crusted',[0,0,0,.3,1,0,.3],.12,'3321100010','seared %','scorched',1],
['grill','Char-grill','grill',6,1,1,'charred',[0,0,0,.6,.7,0,0],.14,'3332100000','char-grilled %','burnt',1],
['roast','Roast','roast',3,10,1,'tender',[.5,0,0,0,.5,0,0],.08,'3232200020','roasted %','dried out',1],
['fry','Deep-fry','deep-fry',4,2,2,'crisp',[0,0,0,0,.3,0,1.2],.15,'2321311012','crispy fried %','greasy',1],
['braise','Pressure-braise','braise',4,16,2,'melting',[0,0,0,0,1,0,.5],.08,'3121100201','braised %','still tough',0],
['poach','Poach','poach',3,5,1,'silky',[0,0,0,0,0,0,0],.06,'2313000100','poached %','rubbery',0],
['boil','Boil','boil',2,8,1,'soft',[0,0,0,0,0,0,0],.05,'1220300100','simmered %','waterlogged',0],
['puree','Purée','purée',5,0,2,'smooth',[0,0,0,0,0,0,.3],.05,'0033221222','% purée','grainy',0],
['pickle','Quick-pickle','pickle',2,6,2,'snappy',[.3,.5,2,0,0,0,0],.04,'0133000001','pickled %','harsh',0],
['reduce','Reduce to a glaze','reduce',3,7,2,'glossy',[0,0,0,0,0,0,0],.12,'0012022301','% glaze','broken',1],
['caramel','Caramelise','caramelise',6,0,2,'brittle',[1,0,0,.6,0,0,0],.2,'1023111130','caramelised %','burnt and bitter',1],
['bake','Bake','bake',5,12,2,'crumb',[.3,0,0,0,0,0,.3],.15,'0012322120','baked %','raw in the middle',1],
['churn','Churn ice cream','churn',4,12,2,'frozen',[.3,0,0,0,0,0,.8],.2,'0013033222','% ice cream','soup that never set',0],
['cure','Cure','cure',3,8,2,'silky',[0,.8,.5,0,0,0,0],.1,'1311000000','cured %','mushy',0],
['smoke','Smoke','smoke',3,7,2,'tender',[0,0,0,.5,.8,0,0],.12,'3221020020','smoked %','acrid',1],
['whip','Whip into a mousse','whip',5,0,2,'airy',[0,0,0,0,0,0,.4],.1,'0001031100','% mousse','split',0],
['toast','Toast into a crumb','toast',2,1,1,'crunchy',[0,0,0,.2,0,0,0],.08,'0000302031','toasted % crumb','burnt',1]
].map(r=>({id:r[0],name:r[1],verb:r[2],a:r[3],p:r[4],lvl:r[5],tex:r[6],d:r[7],risk:r[8],fits:r[9],ph:r[10],flaw:r[11],burn:r[12]}));
const T={};TECH.forEach(t=>T[t.id]=t);
// id|name|emoji|category|flavour (sweet salty sour bitter umami heat rich)|texture|colour|courses|oddball|fit overrides|hint
const RAW_ING=`
duck|Duck breast|🦆|P|0100304|tender|r|ae|0|smoke3,cure2,boil0,fry1|A thick fat cap that wants time to render.
pork|Pork tenderloin|🐖|P|0100302|tender|n|ae|0|cure0|Lean. It dries out fast.
lamb|Lamb chops|🍖|P|0100403|tender|r|e|0||Takes fierce heat and smoke.
chick|Chicken thighs|🍗|P|0100302|tender|w|ae|0|fry3|Forgiving, as long as it is cooked through.
steak|Skirt steak|🥩|P|0100403|chewy|r|ae|0|raw2,cure2,braise1,poach0|Fine raw if you cut it small. Tough when stewed in a hurry.
tongue|Beef tongue|👅|P|0100403|chewy|n|e|1|braise3,sear1,grill1,roast1,smoke2,fry1|It needs long, wet heat before anything else.
hotdog|Hot dogs|🌭|P|1300303|soft|n|ae|1|fry3,grill3,braise1,roast2,puree1|Already cooked, already salty.
tofu|Silken tofu|🧊|P|0000101|soft|w|aed|0|raw2,fry3,sear2,puree3,whip3,churn2,grill0,roast1,braise2,smoke2|A blank canvas that blends to a cream.
liver|Chicken livers|🫀|P|0100503|soft|b|ae|1|sear3,puree2,whip2,fry2,braise1,roast1,grill1|Rich and irony. A classic mousse.
salmon|Salmon fillet|🐟|S|0100303|silky|o|ae|0|smoke3,braise0|Fatty enough to cure, smoke or sear.
shrimp|Tiger shrimp|🦐|S|1100201|snappy|n|ae|0|raw1|Seconds separate perfect from rubber.
squid|Squid|🦑|S|0100201|chewy|w|ae|0|raw1,braise3,poach1,roast1|Cook it for two minutes or for forty. Nothing in between.
crab|Crab meat|🦀|S|1200301|soft|w|a|0|sear1,grill0,smoke1,cure1|Sweet, delicate and already cooked.
lobster|Lobster tail|🦞|S|1100302|tender|r|ae|0|raw1,cure1,smoke1|Butter is its best friend. Overcooking is its worst enemy.
oyster|Oysters|🦪|S|0301301|silky|w|a|0|raw3,cure2,sear1,roast2,grill2,boil0,poach2,smoke3|Briny. The less you do, the better.
octo|Octopus|🐙|S|0100301|chewy|p|ae|1|raw0,cure0,braise3,boil3,sear1,grill2,fry1,poach2|It must be tenderised with slow, wet heat.
sardine|Tinned sardines|🥫|S|0300503|soft|b|ae|1|raw2,cure0,poach0,boil0,puree2,fry2|Oily, loud and already cooked.
eggplant|Eggplant|🍆|V|0001001|soft|p|ae|0|raw0,fry3,puree3,smoke3|Bitter and spongy raw. It loves fire.
carrot|Heirloom carrots|🥕|V|2000000|crunchy|o|aed|0|bake3,caramel3|Sweet enough for the pastry station.
corn|Sweet corn|🌽|V|3000100|crisp|y|aed|0|churn2,puree3,bake2|Milky and sweet. It crosses over to dessert easily.
broc|Broccoli|🥦|V|0001100|crunchy|g|ae|0||Chars well. Goes grey if boiled too long.
kale|Tuscan kale|🥬|V|0002000|chewy|g|ae|0|fry3,raw1,puree2|Bitter and tough until it is crisped or wilted.
pump|Pumpkin|🎃|V|2000001|soft|o|aed|0|raw0,bake3,churn2,puree3|Starchy and sweet. Useless raw.
pepper|Bell peppers|🫑|V|1001000|crisp|g|ae|0||Roast them until the skins blister.
dill|Dill pickles|🥒|V|0340000|snappy|g|ae|1|raw3,fry3,pickle0,puree2,grill1,sear0,roast0,braise1|Sour and salty already. Fry them or leave them alone.
avo|Avocado|🥑|V|0000004|creamy|g|aed|0|raw3,puree3,churn3,whip2,fry2,grill2,roast0,braise0,boil0,sear1,pickle1|It turns bitter when cooked through.
olive|Green olives|🫒|V|0312002|firm|g|ae|0|raw3,fry2,puree3,braise2,pickle1,caramel0|Salt and fat in one bite.
peas|Sugar snap peas|🫛|V|2000000|crisp|g|ae|0|raw3,braise0,roast1|Sweet and snappy. Barely cook them.
yam|Sweet potato|🍠|V|3000001|soft|o|aed|0|raw0,fry3,bake3,puree3,churn2|Dense and sweet. It needs real cooking time.
melon|Watermelon|🍉|F|3000000|crisp|r|aed|0|grill3,pickle3,sear2,roast0,bake0|Grill it or pickle it. It weeps in an oven.
pine|Pineapple|🍍|F|3020000|juicy|y|aed|0|grill3,roast3,caramel3,whip0|Raw, its enzymes stop dairy from setting.
mango|Mango|🥭|F|4010000|soft|o|aed|0|pickle3,bake1|Very sweet. It wants acid or chili.
peach|Peaches|🍑|F|3010000|soft|o|aed|0|grill3,roast3|Fire brings out the sugar.
cherry|Sour cherries|🍒|F|2030000|juicy|r|aed|0|reduce3|Sharp. Superb cooked down next to rich meat.
straw|Strawberries|🍓|F|3020000|soft|r|ad|0|roast3,grill1,sear0|Delicate. They collapse over direct heat.
blue|Blueberries|🫐|F|2020000|juicy|p|aed|0|reduce3,pickle3,grill0,sear0|They burst into sauce in minutes.
banana|Bananas|🍌|F|4000001|creamy|y|d|0|caramel3,fry3,bake3,pickle0,poach1|Sugar and starch. They caramelise fast.
pear|Bosc pears|🍐|F|3000000|crisp|y|aed|0|poach3|Firm enough to poach or roast whole.
grape|Red grapes|🍇|F|3010000|juicy|p|aed|0|roast3,pickle3,poach1|Roasting turns them jammy.
coco|Fresh coconut|🥥|F|1000003|chewy|w|aed|0|toast3,puree2,pickle0,poach0,grill1|More fat than sugar. Toast it.
kiwi|Kiwi|🥝|F|2030000|soft|g|ad|0|whip0,bake0,roast0,grill1|Raw kiwi curdles dairy.
apple|Green apples|🍏|F|2030000|crisp|g|aed|0|bake3,caramel3|Tart and firm. It holds its shape in heat.
orange|Blood oranges|🍊|F|2031000|juicy|r|aed|0|reduce3|Bittersweet. The juice reduces to a fine glaze.
ramen|Instant ramen|🍜|C|0200201|soft|y|ae|1|boil3,fry3,toast3,bake1,puree0|Crush it for crunch or fry it into a nest.
pretzel|Hard pretzels|🥨|C|0300000|crunchy|b|aed|1|toast3,bake2,raw2,caramel2,boil0,fry1,puree1|Salt and crunch. Soggy the moment it gets wet.
bagel|Everything bagels|🥯|C|0200100|chewy|b|ae|1|toast3,bake2,fry2,boil0,raw1|Seeds, garlic and chew.
crois|Croissants|🥐|C|1100004|crisp|b|aed|1|toast3,bake3,raw2,fry1,boil0|Mostly butter. Makes a superb bread pudding.
tort|Corn tortillas|🫓|C|0100000|soft|y|ae|0|fry3,toast3,grill2,bake2,boil1|Fry them and they shatter.
popcorn|Popcorn|🍿|C|0200000|crunchy|w|aed|1|raw2,toast2,caramel3,puree2,churn2,boil0,fry0,bake1|Steep it in cream or coat it in caramel.
waffle|Frozen waffles|🧇|C|2100001|crisp|y|aed|1|toast3,bake3,fry2,boil0|Sweet batter, already cooked.
fries|Frozen fries|🍟|C|0100001|crisp|y|ae|1|fry3,roast2,bake2,puree2,boil1,toast1|Potato with a head start.
chickp|Chickpeas|🫘|C|0000101|firm|y|aed|0|fry3,roast3,puree3,boil2,bake2,toast1,whip2|The canning liquid whips like egg white.
dump|Dumpling wrappers|🥟|C|0000000|soft|w|aed|0|fry3,boil3,bake2,toast1,raw0|Thin dough. Fry it for crunch.
bluech|Blue cheese|🧀|D|0402403|creamy|w|aed|1|raw3,whip2,churn2,puree2,bake2,reduce1,fry1,smoke1|Funky and salty. It gets along with sweet things.
icecream|Vanilla ice cream|🍨|D|4000003|frozen|w|d|1|raw2,whip2,reduce2,fry2,churn1,bake1|Melted, it is a ready-made custard.
flan|Caramel flan|🍮|D|4000002|silky|y|d|1|raw2,puree2,whip2,churn3,bake2,reduce1|Set custard. It blends into a rich base.
goat|Goat cheese|🐐|D|0202202|creamy|w|aed|0|raw3,whip3,fry2,bake2,churn2|Tangy. Whips into a mousse.
gummy|Gummy bears|🧸|W|5010000|chewy|r|ad|1|reduce3,raw1,churn1,caramel1,bake0,toast0,whip0,fry0|Melt them. The gelatin sets a glaze.
donut|Glazed donuts|🍩|W|4000003|soft|b|aed|1|bake3,toast2,sear2,grill2,churn2,raw1,puree1,fry1|Fried dough and sugar. Griddle it.
cookie|Sandwich cookies|🍪|W|4001002|crunchy|k|d|1|toast3,churn3,raw2,bake2,puree2,fry2,whip1|Cocoa and cream. An instant crumb.
choc|Dark chocolate|🍫|W|2003003|snappy|k|ed|0|reduce3,whip3,churn3,bake3,raw2,caramel0,toast0,fry0|It seizes if water gets in. Melt it gently.
cake|Birthday cake|🍰|W|5000003|soft|n|d|1|toast3,churn2,fry2,raw1,bake1,puree1,whip1|Too sweet as it comes. Dry it into crumbs.
candy|Peppermint candies|🍬|W|5000000|brittle|r|d|1|reduce3,raw2,churn2,caramel1,bake1,whip1,toast0|Crush for sparkle or melt into syrup.
mochi|Mochi|🍡|W|3000000|chewy|n|d|1|grill3,fry3,toast2,raw2,bake2,churn1,reduce0|Rice dough. It blisters and puffs over heat.
fortune|Fortune cookies|🥠|W|3000000|crunchy|y|ad|1|toast3,raw2,churn1,bake1,puree1|Thin, sweet and brittle.
maple|Maple syrup|🍁|X|5000100|liquid|b|aed|0|reduce3,caramel3,churn2,braise2,raw2,whip1|Woody sweetness. Glazes meat as well as dessert.
cola|Cola|🥤|X|5011000|liquid|k|aed|1|reduce3,braise3,churn2,caramel2,raw0,pickle1,poach1|It reduces to a spiced caramel.
coffee|Cold brew coffee|☕|X|0004000|liquid|k|aed|1|churn3,reduce2,braise2,whip2,bake2,raw1,poach1|Bitter backbone for red meat or for cream.
matcha|Matcha|🍵|X|0003100|powder|g|ad|1|churn3,whip3,bake3,raw2,reduce1,braise0|Grassy and bitter. It needs fat and sugar.
beer|Stout|🍺|X|1003100|liquid|k|aed|1|braise3,bake3,reduce2,churn2,raw0|Roasty and bitter. Braise with it or bake with it.
wine|Red wine|🍷|X|1021000|liquid|p|aed|0|reduce3,braise3,poach3,pickle2,churn2,raw0|Reduce it or it tastes raw.
bourbon|Bourbon|🥃|X|1002000|liquid|b|aed|1|reduce3,caramel3,braise2,churn2,whip2,cure2,raw0|Cook off the burn or it flattens the dish.
boba|Bubble tea|🧋|X|4001002|liquid|b|d|1|churn3,reduce2,whip2,poach2,raw1,bake1|Milky black tea with chewy pearls.
kimchi|Kimchi|🫙|X|0232230|crunchy|r|ae|1|raw3,braise3,fry2,sear2,grill2,puree2,reduce1,pickle0,churn0|Fermented, sour and hot. It lifts fatty meat.
miso|White miso|🥣|X|1400500|paste|y|aed|1|reduce3,braise3,caramel3,raw2,churn2,bake2,cure2,whip1|Salty-sweet depth. Stunning in caramel.
pb|Peanut butter|🥜|N|1100205|creamy|b|aed|1|puree3,churn3,whip3,bake3,reduce2,raw2,toast0,caramel1,roast0,smoke0|Heavy. Thin it into a sauce or churn it.
sake|Sake|🍶|X|1010200|liquid|w|ae|0|poach3,braise3,cure3,reduce2,pickle2,churn1,raw0|Clean and savoury. Made for seafood.
champ|Champagne|🍾|X|1020000|liquid|y|ad|1|poach3,churn3,reduce2,whip2,pickle2,raw1,braise1|Bright acid. Poach in it or freeze it.
curry|Red curry paste|🍛|X|0201342|paste|o|ae|0|braise3,reduce3,fry2,raw1,churn0|Heat and aroma. Fry it out first.
`.trim().split('\n');
const RAW_PANTRY=`
oil|Olive oil|🫗|X|0001005|liquid|y|||raw3|
butter|Butter|🧈|D|0100005|creamy|y|||reduce3,sear1,caramel2|
cream|Cream|🥛|D|1000004|liquid|w||||
egg|Eggs|🥚|D|0000203|soft|y|||poach3,boil3,fry2,bake3,whip3,churn3,sear2,cure2,raw1|
flour|Flour|🌾|C|0000000|powder|w|||bake3,fry3,toast1,boil0,raw0|
sugar|Sugar|🥄|W|5000000|powder|w|||caramel3,reduce3,raw1,churn2,whip2|
rice|Rice|🍚|C|0000000|soft|w|||boil3,fry2,toast2,puree1|
potato|Potatoes|🥔|C|0000000|soft|y|||fry3,roast3,boil3,puree3,raw0,toast0|
onion|Onions|🧅|V|2000100|crisp|w|||caramel3,pickle3,fry3,raw1|
garlic|Garlic|🧄|H|0001201|firm|w|||roast3,fry2,puree2,raw1,braise2|
lemon|Lemons|🍋|F|0050000|juicy|y|||raw3,reduce2,cure2,pickle2|
tomato|Tomatoes|🍅|V|1020300|juicy|r|||raw3,roast3,reduce3,puree3|
chili|Fresh chilies|🌶️|H|0000050|crisp|r|||raw3,pickle3,fry2,reduce2,roast2|
ginger|Ginger|🫚|H|0001020|firm|y|||pickle3,fry2,reduce2|
soy|Soy sauce|🥢|X|0500400|liquid|k||||
vinegar|Rice vinegar|🧴|X|0050000|liquid|w||||
honey|Honey|🍯|X|5000000|liquid|y|||caramel3,churn2|
stock|Chicken stock|🍲|X|0200300|liquid|y||||
wwine|White wine|🥂|X|0020000|liquid|y|||poach3,raw0|
herbs|Soft herbs|🌿|H|0001000|soft|g|||puree3,fry2|
mint|Mint|🍃|H|0001000|soft|g|||churn3,puree2|
bacon|Bacon|🥓|P|0300404|crisp|r|||fry3,sear3,roast3,caramel2,bake2,braise2,raw0,poach0,cure0,churn1|
mush|Mushrooms|🍄|V|0000300|soft|b|||sear3,roast3,pickle2|
almond|Almonds|🌰|N|0000102|crunchy|b||||
bread|Bread|🍞|C|0100000|soft|b|||toast3,fry3,bake2,grill2,puree1|
greens|Salad greens|🥗|V|0001000|crisp|g|||raw3,roast0,grill0,braise0,fry0,boil0|
yogurt|Yogurt|🍦|D|0020002|creamy|w||||
vanilla|Vanilla|🌼|H|1000000|soft|w|||churn3,whip2,bake2,reduce2|
spice|Warm spices|🍂|H|0001010|powder|b|||toast3,bake2,braise2|
`.trim().split('\n');
const I={},BASKET_POOL=[],PANTRY=[];
function parseIng(line,pantry){const [id,name,em,cat,f,tex,col,courses,odd,ov,hint]=line.split('|');const o={};(ov||'').split(',').filter(Boolean).forEach(s=>o[s.slice(0,-1)]=+s.slice(-1));
  I[id]={id,name,em,cat,f:[...f].map(Number),tex,col,courses:courses||'',odd:odd==='1',ov:o,hint:hint||'',pantry};(pantry?PANTRY:BASKET_POOL).push(id)}
RAW_ING.forEach(l=>parseIng(l,false));RAW_PANTRY.forEach(l=>parseIng(l,true));
const FIN={salt:{name:'Flaky salt',d:[0,1.1,0,0,0,0,0]},acid:{name:'Squeeze of lemon',d:[0,0,.7,0,0,0,0]},heat:{name:'Chili oil',d:[0,0,0,0,0,.8,.2]},sweet:{name:'Drizzle of honey',d:[.7,0,0,0,0,0,0]},fat:{name:'Brown butter',d:[0,0,0,0,.2,0,.7]},green:{name:'Picked herbs',d:[0,0,0,.1,0,0,0]}};
const PLATE=[{name:'Rustic',min:0,pts:0},{name:'Composed',min:2,pts:1},{name:'Fine dining',min:4,pts:2}];
const ROLES={main:{name:'Centre',w:3},side:{name:'Side',w:2},sauce:{name:'Sauce',w:1.5},garnish:{name:'Garnish',w:.6}};
const COURSES=[
 {name:'Appetizer',min:20,brief:'Bright, light and sharp. It should wake the palate up.',tg:[[0,1.8,1],[1,2.8,1.2],[.8,3,1],[0,1.5,.8],[.8,4,.6],[0,2.5,.6],[.5,2.6,.8]]},
 {name:'Entrée',min:30,brief:'Savoury depth, properly seasoned, with something to cut the richness.',tg:[[0,1.6,1],[1.2,3,1.2],[.5,2.5,.8],[0,1.5,.8],[1.8,5,1],[0,3,.5],[1.2,3.5,.7]]},
 {name:'Dessert',min:30,brief:'Sweet but not cloying, with a pinch of salt and some acid.',tg:[[2.2,3.8,1.3],[.2,1.4,.8],[.3,2.5,.6],[0,1.6,.6],[0,1,1],[0,1.2,.6],[1.2,3.8,.7]]}];
const FLNOTE=[['It is not sweet enough to call a dessert.','Too sweet. It reads like candy.'],['Underseasoned. It needed salt.','Too salty. I am reaching for water.'],['It is crying out for acid.','Too sharp. The sourness takes over.'],['','There is a bitterness I cannot get past.'],['It lacks depth. Nothing savoury anchors it.','Too savoury for this course.'],['','The heat runs over everything else.'],['Thin. It needs some richness.','Heavy. I could not finish this.']];
const DIFFS=[{name:'Very easy',n:2,q:.35,forget:.2,aiRisk:1.3,clock:6,myRisk:.6,pay:.5,reveal:1},{name:'Easy',n:3,q:.5,forget:.12,aiRisk:1.15,clock:3,myRisk:.8,pay:.75},{name:'Normal',n:6,q:.65,forget:.06,aiRisk:1,clock:0,myRisk:1,pay:1},{name:'Hard',n:12,q:.78,forget:.03,aiRisk:.9,clock:-1,myRisk:1,pay:1.5},{name:'Very hard',n:24,q:.88,forget:.01,aiRisk:.8,clock:-2,myRisk:1.1,pay:2},{name:'Extreme',n:45,q:.95,forget:0,aiRisk:.7,clock:-3,myRisk:1.2,pay:3}];
const VENUES=['Back-Alley Pop-Up','Farmers’ Market','Harbour Shack','Night Market','Bistro Row','Rooftop Grill','Grand Hotel','Vineyard Estate','Network Studio','Champions’ Table'];
const BANNABLE=['fry','churn','grill','braise','bake','smoke','puree','pickle'];
const PERKS={knives:{name:'Sharp knives',text:'Every component takes one minute less of hands-on time.',wins:0},cool:{name:'Cool head',text:'Re-firing a failed component costs half the time.',wins:3},palate:{name:'Iron palate',text:'You can read how well every technique suits every ingredient.',wins:8},show:{name:'Showman',text:'Composed plating costs no time.',wins:15}};
const AI=[{id:'vex',name:'Dario Vex',tag:'Gambler. Rushes ambitious techniques.',style:'gamble'},{id:'sato',name:'Mei-Lin Sato',tag:'Technician. Careful and rarely burns a thing.',style:'tech'},{id:'costa',name:'Bruna Costa',tag:'Comfort cook. Simple, hearty, well seasoned.',style:'comfort'},{id:'oke',name:'Tunde Oke',tag:'Avant-garde. Transforms everything he touches.',style:'avant'},{id:'hal',name:'Greta Hal',tag:'Forager. Raw, pickled and acidic.',style:'fresh'}];
const CRISP=['crisp','snappy','brittle','crunchy'];
const JUDGES=[
 {id:'od',name:'Odile Marchetti',tag:'The classicist',bio:'Rewards the right technique for each ingredient. Dislikes crowded plates.',
  f:x=>x.nIng>8?{t:-.9,s:'Too many ideas on one plate. Edit.',g:0}:x.avgAff>=2.6?{t:.9,s:'Every ingredient was treated the way it wants to be treated.',g:1}:x.avgAff<1.6?{t:-1,s:'You fought your ingredients instead of listening to them.',g:0}:{t:(x.avgAff-2)*.8}},
 {id:'rq',name:'Rafa Quintero',tag:'The heat seeker',bio:'Wants chili in savoury food. Finds timid plates boring.',
  f:x=>x.ci<2?(x.v[5]>=1.2&&x.v[5]<=3.4?{t:1,s:'That heat builds and then lets go. Exactly right.',g:1}:x.v[5]<.4?{t:-.8,s:'Where is the fire? This is timid cooking.',g:0}:{}):(x.v[5]>=.3&&x.v[5]<=1.2?{t:.6,s:'A whisper of heat in a dessert. I love that.',g:1}:{})},
 {id:'is',name:'Ingrid Solberg',tag:'The acid test',bio:'Wants brightness. Punishes rich food with nothing to cut it.',
  f:x=>x.v[6]-x.v[2]>1.6?{t:-1,s:'All that richness and nothing sharp to cut it.',g:0}:x.v[2]>=(x.ci<2?1.6:1)?{t:1,s:'The acidity keeps me coming back for another bite.',g:1}:{}},
 {id:'bn',name:'Bao Nguyen',tag:'The modernist',bio:'Scores creativity hard. Basket items served as they came bore him.',
  f:x=>x.lazy>0?{c:-.8*x.lazy,s:'I could have opened that basket myself. Transform it.',g:0}:x.deep>=3?{c:1.2,s:'You changed what these ingredients are. That is the job.',g:1}:{}},
 {id:'do',name:'Dee Okafor',tag:'The seasoning sentinel',bio:'Salt has to be exact. A little under or over costs you.',
  f:x=>{const lo=x.ci<2?1.6:.5,hi=x.ci<2?2.7:1.2;return x.v[1]>=lo&&x.v[1]<=hi?{t:.9,s:'Seasoned to the grain. That takes discipline.',g:1}:{t:-Math.min(1.5,Math.max(lo-x.v[1],x.v[1]-hi)*1.2),s:x.v[1]<lo?'I keep looking for the salt.':'Somebody was heavy-handed with the salt.',g:0}}},
 {id:'tv',name:'Teodor Vance',tag:'The texture fiend',bio:'Needs crunch on every plate. Loves contrast.',
  f:x=>!x.crisp?{p:-1.2,t:-.4,s:'It is all one texture. Give me something to bite.',g:0}:x.nTex>=3?{p:1,s:'Crunch, cream, chew. My fork stays busy.',g:1}:{}},
 {id:'pr',name:'Priya Raman',tag:'The basket hawk',bio:'Basket items must lead a component. Hiding them costs you.',
  f:x=>x.hidden>0?{c:-.9*x.hidden,s:'You hid the basket. I had to go looking for it.',g:0}:x.leads>=4?{c:1.1,s:'All four basket items stand front and centre.',g:1}:{c:x.leads*.15}},
 {id:'ha',name:'Henrik Aldous',tag:'The pastry purist',bio:'Dessert must be dessert. Sweetness has no place in savoury courses.',
  f:x=>x.ci===2?(x.v[4]>1.1?{t:-1,s:'This is dinner dressed up as a dessert.',g:0}:x.pastry?{t:1,s:'Real pastry work under this clock. Bravo.',g:1}:{}):(x.v[0]>1.9?{t:-1,s:'Far too sweet for a savoury course.',g:0}:{})}
];
/* ================= RULES ================= */
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rngFrom(s){let a=hash(s)||1;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const shuffle=(a,r)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const aff=(ing,t)=>ing.ov[t.id]!==undefined?ing.ov[t.id]:+t.fits[CATS.indexOf(ing.cat)];
const FITNAME=['a disaster','awkward','sound','ideal'];
// A level's rules. lvl 0-49 is the career; lvl -1 is a head-to-head match. The same lvl and diff always give the same rules.
function makeCfg(lvl,diff){const D=DIFFS[diff],duel=lvl<0,L=duel?12:lvl,v=Math.floor(L/5),s=duel?0:L%5,r=rngFrom('level|'+L);
  const K={lvl,diff,n:Math.max(1,Math.round(D.n*(1+L/49*1.5)*(s===4?1.5:1))),q:Math.min(.97,D.q+L/49*.1),forget:D.forget,aiRisk:D.aiRisk,myRisk:D.myRisk,reveal:!!D.reveal,
    clock:D.clock-(duel?0:Math.floor(L/12)),odd:duel?1+(diff>=4?1:0):Math.min(3,1+Math.floor(L/15)),ban:[],short:[],five:false,twists:[],name:duel?'Head-to-head':VENUES[v]+' · '+(s===4?'Final':'Heat '+(s+1)),prize:duel?0:Math.round(500*(L+1)*D.pay/50)*50};
  if(!duel){if((s===1&&v>=1)||(s===4&&v>=5))K.ban=shuffle(BANNABLE,r).slice(0,v>=6?2:1);if(s===2&&v>=2)K.short=shuffle(PANTRY,r).slice(0,8+v);if(s===3&&v>=3)K.five=true}
  if(K.odd>1)K.twists.push(K.odd+' oddballs in every basket');
  if(K.clock)K.twists.push(Math.abs(K.clock)+(Math.abs(K.clock)===1?' minute ':' minutes ')+(K.clock>0?'extra':'less')+' on every clock');
  if(K.ban.length)K.twists.push('Station down: nobody can '+K.ban.map(t=>T[t].verb).join(' or '));
  if(K.short.length)K.twists.push('Bare pantry: '+K.short.length+' staples are missing');
  if(K.five)K.twists.push('Five ingredients in every basket');
  if(s===4)K.twists.push('Final: the rivals plan harder');
  if(K.reveal)K.twists.push('You can see how well every technique suits every ingredient');
  return K}
function budgetFor(ci,K){return Math.max(12,COURSES[ci].min+K.clock)}
function plateMin(d,perk){return perk==='show'&&d.plate===1?0:PLATE[d.plate].min}
function compTime(c,perk){const t=T[c.tech];if(!t||!c.ings.length)return{a:0,p:0};const pm=[.7,1,1.35][c.pace];return{a:Math.max(1,Math.round((t.a+c.ings.length-1)*pm)-(perk==='knives'?1:0)),p:Math.round(t.p*pm)}}
function dishTime(d,perk){let a=plateMin(d,perk),long=0;for(const c of d.comps){const x=compTime(c,perk);a+=x.a;long=Math.max(long,x.a+x.p)}return{a,long:long+plateMin(d,perk)}}
function feasible(d,budget,perk){const x=dishTime(d,perk);return x.a<=budget&&x.long<=budget}
function pFail(c,mul){const t=T[c.tech],a=aff(I[c.ings[0]],t);let p=t.risk+(2-a)*.14+[.15,0,-.07][c.pace]+(c.ings.length-1)*.02;p=clamp(p*(mul||1),.02,.95);return a===0?Math.max(p,.85):p}
function rollOut(c,r,mul){const p=pFail(c,mul),x=r();if(x<p*.3)return 0;if(x<p)return 1;const a=aff(I[c.ings[0]],T[c.tech]);return r()<.15+a*.07+(c.pace===2?.12:c.pace===0?-.1:0)?3:2}
function compVec(c){const t=T[c.tech];let v=[0,0,0,0,0,0,0],w=0;c.ings.forEach((id,i)=>{const k=i?1:2;w+=k;I[id].f.forEach((x,j)=>v[j]+=x*k)});
  v=v.map((x,j)=>(x/w+t.d[j])*(t.id==='reduce'?1.25:1));
  if(c.out===1){if(t.burn)v[3]+=1.5;else v=v.map(x=>x*.75)}else if(c.out===0){if(t.burn)v[3]+=3;else v=v.map(x=>x*.5)}
  return v.map(x=>clamp(x,0,5))}
function dishVec(d){let v=[0,0,0,0,0,0,0],w=0;for(const c of d.comps){const k=ROLES[c.role].w;w+=k;compVec(c).forEach((x,j)=>v[j]+=x*k)}
  v=v.map(x=>w?x/w:0);for(const f of d.fin)FIN[f].d.forEach((x,j)=>v[j]+=x);return v.map(x=>clamp(x,0,5))}
const low=s=>s.charAt(0).toLowerCase()+s.slice(1);
function phrase(c,basket){const names=c.ings.filter((id,i)=>i===0||basket.includes(id)).map(id=>low(I[id].name));return T[c.tech].ph.replace('%',names.join(' and '))}
function dishTitle(d,basket){if(!d.comps.length)return 'An empty plate';const p=d.comps.map(c=>phrase(c,basket));const rest=p.slice(1);let s=p[0];if(rest.length)s+=' with '+(rest.length>1?rest.slice(0,-1).join(', ')+' and ':'')+rest[rest.length-1];return s.charAt(0).toUpperCase()+s.slice(1)}
// Scores one dish for a panel of three judges. Pure: the same dish and judges always give the same result.
function scoreDish(d,basket,ci,judgeIdx){
  const notes=[],v=dishVec(d),tex=new Set(),col=new Set(),techs=new Set(),use={};let exec=0,wsum=0,nIng=new Set(),flaws=0,pastry=false;
  for(const c of d.comps){const t=T[c.tech],lead=I[c.ings[0]],w=ROLES[c.role].w,a=aff(lead,t);wsum+=w;techs.add(t.id);exec+=w*[-3,-1.4,0,.6][c.out];
    if(c.out>=2){tex.add(t.tex||lead.tex);c.ings.forEach(id=>col.add(I[id].col));if(['bake','churn','whip','caramel'].includes(t.id))pastry=true}else flaws+=c.out?1:2.5;
    c.ings.forEach(id=>nIng.add(id));
    if(c.out<=1)notes.push({g:0,w:w*(c.out?1.5:3),s:'The '+low(lead.name)+' came out '+t.flaw+'.'});
    else if(c.out===3)notes.push({g:1,w:w*.8,s:'Perfect execution on the '+phrase(c,basket)+'.'});
    if(ci<2&&t.id==='churn'&&(c.role==='main'||c.role==='side')){exec-=w*.9;notes.push({g:0,w:2.2,s:'Ice cream as the heart of a savoury course? No.'})}
    if(a<=1&&c.out>=2)notes.push({g:0,w:w*.9,s:'To '+t.verb+' '+low(lead.name)+' was the wrong call. It shows.'});
    c.ings.forEach((id,i)=>{if(!basket.includes(id))return;const ea=i?clamp(aff(I[id],t),1,2):a,lv=t.lvl*(i?.75:1)*(c.out>=2?1:.5)*(c.role==='garnish'?.5:1);
      const u={ea,lv,lead:i===0&&c.role!=='garnish',hidden:c.role==='garnish'||(i>0&&c.ings.length>=3),t,c,ok:c.out>=2};
      if(!use[id]||u.lv+u.ea>use[id].lv+use[id].ea)use[id]=u})}
  // taste
  let pen=0;COURSES[ci].tg.forEach(([lo,hi,w],j)=>{const dist=v[j]<lo?lo-v[j]:v[j]>hi?v[j]-hi:0;if(dist>.15){pen+=dist*w*1.3;const s=FLNOTE[j][v[j]<lo?0:1];if(s)notes.push({g:0,w:dist*w*2,s,k:'ax'+j})}});
  if(v[6]-v[2]>2.2){pen+=(v[6]-v[2]-2.2);notes.push({g:0,w:1.5,s:'Rich on rich. Nothing lifts it.'})}
  const used=basket.filter(id=>use[id]),missing=basket.filter(id=>!use[id]);
  const avgAff=used.length?used.reduce((s,id)=>s+use[id].ea,0)/used.length:1;
  const layered=v.filter(x=>x>=1).length>=4;if(layered&&pen<.4)notes.push({g:1,w:1.2,s:'It is layered. Every bite shows me something else.'});
  let taste=6.5-Math.min(pen,5)+(wsum?exec/wsum*2:-4)+(avgAff-2)+(layered?.8:0);
  // creativity
  let cre=1,deep=0,lazy=0,leads=0,hidden=0;
  for(const id of used){const u=use[id];cre+=u.lv*.65;if(u.lv>=1.5)deep++;if(u.t.lvl===0)lazy++;if(u.lead)leads++;if(u.hidden)hidden++;
    if(I[id].odd&&u.lv>=1.5&&u.ea>=2){cre+=.5;notes.push({g:1,w:1.6,s:'Turning '+low(I[id].name)+' into '+phrase(u.c,basket)+' is real thinking.'})}
    if(u.t.lvl===0&&I[id].odd)notes.push({g:0,w:1.3,s:'The '+low(I[id].name)+' is on the plate exactly as it came out of the basket.'})}
  cre+=techs.size>=3?1:techs.size===1&&d.comps.length>1?-1:0;
  cre+=Math.min(2,d.comps.filter(c=>c.ings.filter(id=>basket.includes(id)).length>=2&&c.out>=2).length)*.6;
  // presentation
  const crisp=[...tex].some(x=>CRISP.includes(x));
  let pres=2+[0,0,.8,1.6,2][Math.min(4,d.comps.length)]+Math.min(2.1,Math.max(0,tex.size-1)*.7)+Math.min(1.5,Math.max(0,col.size-1)*.5)+(crisp?.5:0)+PLATE[d.plate].pts-flaws*.8+(d.fin.includes('green')?.4:0)+(d.left>=2?.3:0);
  if(d.comps.length>=3&&tex.size>=3&&d.plate>0)notes.push({g:1,w:1,s:'A handsome plate. Height, colour, contrast.'});
  if(d.comps.length<=1)notes.push({g:0,w:1.4,s:'One thing on a plate is a snack, not a dish.'});
  for(const id of missing){taste-=2.5;cre-=3;pres-=1;notes.push({g:0,w:6,s:'Where is the '+low(I[id].name)+'? You left a basket ingredient off the plate.'})}
  if(!d.comps.length){taste=0;cre=0;pres=0}
  const x={v,ci,nIng:nIng.size,avgAff,deep,lazy,leads,hidden,crisp,nTex:tex.size,pastry};
  const half=n=>Math.round(clamp(n,0,10)*2)/2;
  const judges=judgeIdx.map((ji,k)=>{const J=JUDGES[ji],b=J.f(x)||{};const t=half(taste+(b.t||0)),c=half(cre*(J.id==='bn'?1.15:1)+(b.c||0)),p=half(pres+(b.p||0));
    const skip={do:'ax1',is:'ax2',rq:'ax5'}[J.id],bads=notes.filter(n=>!n.g&&!(b.s&&n.k===skip)).sort((a,b)=>b.w-a.w),goods=notes.filter(n=>n.g).sort((a,b)=>b.w-a.w),say=[];
    if(b.s)say.push(b.s);const bd=bads[Math.min(k,bads.length-1)]||bads[0],gd=goods[Math.min(k,goods.length-1)]||goods[0];
    if(bads[0]&&bads[0].w>=5&&!say.includes(bads[0].s))say.unshift(bads[0].s);
    if(t+c+p>=21){if(gd)say.push(gd.s);if(bd&&say.length<3)say.push(bd.s)}else{if(bd)say.push(bd.s);if(gd&&say.length<3)say.push(gd.s)}
    if(!say.length)say.push('Competent. I will not remember it tomorrow.');
    return{id:J.id,t,c,p,total:t+c+p,say:[...new Set(say)].slice(0,3)}});
  return{judges,total:judges.reduce((s,j)=>s+j.total,0),v,missing}}
function pickBasket(seed,round,K){const r=rngFrom(seed+'|basket|'+round),ch='aed'[round],pool=BASKET_POOL.filter(id=>I[id].courses.includes(ch)),out=[];
  const take=f=>{const o=shuffle(pool.filter(id=>!out.includes(id)&&f(I[id])),r);out.push(o[0]||shuffle(pool.filter(id=>!out.includes(id)),r)[0])};
  const size=K.five?5:4,nOdd=Math.min(K.odd,size-1),plain=size-nOdd;
  take(i=>(round===2?i.cat==='F':'PS'.includes(i.cat))&&!i.odd);
  if(plain>=2)take(i=>(round===0?'VF':round===1?'VCF':'DWC').includes(i.cat)&&!i.odd);
  for(let k=2;k<plain;k++)take(i=>!i.odd);for(let k=0;k<nOdd;k++)take(i=>i.odd);
  return out}
const pickJudges=seed=>shuffle(JUDGES.map((_,i)=>i),rngFrom(seed+'|judges')).slice(0,3);
const pickRivals=(seed,n)=>shuffle(AI,rngFrom(seed+'|rivals')).slice(0,n);
const LEADS=[['potato','rice','onion','tomato','mush','greens','bread','bacon','egg'],['potato','rice','onion','tomato','mush','greens','bread','bacon','egg'],['cream','flour','egg','yogurt','almond','bread','butter','sugar']];
const SUPP=[['oil','butter','garlic','lemon','chili','ginger','soy','vinegar','stock','wwine','herbs','bacon','onion','tomato','honey'],null,['sugar','cream','butter','egg','vanilla','honey','lemon','mint','spice','almond','flour','yogurt']];SUPP[1]=SUPP[0];
function aiDish(seed,chef,round,K,judgeIdx){const r=rngFrom(seed+'|ai|'+chef.id+'|'+round),basket=pickBasket(seed,round,K),budget=budgetFor(round,K),TR=K,st=chef.style,pick=a=>a[Math.floor(r()*a.length)];
  const techs=TECH.filter(t=>!K.ban.includes(t.id)),ok=a=>{const f=a.filter(id=>!K.short.includes(id));return f.length?f:a},leads=ok(LEADS[round]),supp=ok(SUPP[round]);
  let best=null,bs=-1e9;
  for(let k=0;k<TR.n;k++){const nC=2+Math.floor(r()*3),roles=['main'].concat(shuffle(['side','sauce','garnish'],r)).slice(0,nC),comps=roles.map(role=>({role,ings:[],tech:null,pace:1,out:2}));
    for(const b of basket){if(r()<TR.forget)continue;const c=pick(comps);(c.ings.length<3?c:comps.find(c=>c.ings.length<3)||c).ings.push(b)}
    for(const c of comps){if(!c.ings.length)c.ings.push(pick(leads));c.ings=c.ings.slice(0,3);const lead=I[c.ings[0]];let o=techs.filter(t=>aff(lead,t)>=2);
      const sub=f=>{const s=o.filter(f);if(s.length)o=s};
      if((st==='avant'||st==='gamble')&&r()<.75)sub(t=>t.lvl===2);if(st==='comfort'&&r()<.7)sub(t=>t.lvl===1);if(st==='fresh'&&r()<.5)sub(t=>['raw','pickle','cure'].includes(t.id));
      c.tech=(r()<TR.q&&o.length?pick(o):pick(techs)).id;
      for(let n=Math.floor(r()*3);n>0&&c.ings.length<3;n--){const s=pick(supp);if(!c.ings.includes(s))c.ings.push(s)}
      c.pace=st==='gamble'&&r()<.45?0:st==='tech'&&r()<.5?2:r()<.15?0:r()<.2?2:1}
    const d={comps,fin:shuffle(Object.keys(FIN),r).slice(0,Math.floor(r()*4)),plate:Math.floor(r()*3),left:0};
    if(st==='comfort'&&!d.fin.includes('salt'))d.fin[0]='salt';if(st==='fresh'&&!d.fin.includes('acid'))d.fin[0]='acid';
    for(let g=0;g<10&&!feasible(d,budget);g++){const c=d.comps.find(c=>c.pace>0);if(d.plate>0)d.plate--;else if(c)c.pace--;else if(d.comps.length>1)d.comps.pop();else break}
    if(!feasible(d,budget))continue;
    const s=scoreDish(d,basket,round,judgeIdx).total-d.comps.reduce((s,c)=>s+pFail(c)*ROLES[c.role].w*4,0);
    if(s>bs){bs=s;best=d}}
  if(!best)best={comps:[{role:'main',ings:[basket[0]],tech:'raw',pace:1,out:2}],fin:['salt'],plate:0,left:0};
  for(const c of best.comps)c.out=rollOut(c,r,K.aiRisk);
  best.left=budget-dishTime(best).a;return best}
function cleanDish(d,round,K,perk){try{if(!d||!Array.isArray(d.comps))return null;const comps=[];
  for(const c of d.comps.slice(0,4)){if(!c||!ROLES[c.role]||!T[c.tech]||K.ban.includes(c.tech)||!Array.isArray(c.ings))return null;const ings=[...new Set(c.ings.filter(id=>typeof id==='string'&&Object.prototype.hasOwnProperty.call(I,id)))].slice(0,3);
    if(!ings.length||![0,1,2].includes(c.pace)||![0,1,2,3].includes(c.out))return null;comps.push({role:c.role,ings,tech:c.tech,pace:c.pace,out:c.out})}
  const out={comps,fin:[...new Set((Array.isArray(d.fin)?d.fin:[]).filter(f=>Object.prototype.hasOwnProperty.call(FIN,f)))].slice(0,3),plate:[0,1,2].includes(d.plate)?d.plate:0,left:clamp(+d.left||0,0,30)};
  const pk=Object.prototype.hasOwnProperty.call(PERKS,perk)?perk:'';if(!feasible(out,budgetFor(round,K),pk))return null;return out}catch(e){return null}}
const B64={enc:s=>btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),dec:s=>decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))))};
function makeResultCode(code,name,perk,dishes,look){const body=B64.enc(JSON.stringify({c:code,n:name,k:perk,d:dishes,l:look}));return 'LP1.'+body+'.'+hash(body).toString(36)}
function readResultCode(str){try{const m=String(str).trim().match(/^LP1\.([\w-]+)\.([a-z0-9]+)$/);if(!m||hash(m[1]).toString(36)!==m[2])return null;return JSON.parse(B64.dec(m[1]))}catch(e){return null}}
const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(diff){let s='';for(let i=0;i<5;i++){let k;do{k=Math.floor(Math.random()*32)}while(i===0&&k%6!==diff);s+=ALPHA[k]}return s}
const codeDiff=code=>ALPHA.indexOf(code[0])%6;
const okCode=s=>typeof s==='string'&&s.length===5&&[...s].every(c=>ALPHA.includes(c));
if(typeof module!=='undefined')module.exports={I,T,TECH,DIFFS,makeCfg,AI,JUDGES,scoreDish,aiDish,pickBasket,pickJudges,pickRivals,dishTitle,cleanDish,makeResultCode,readResultCode,newCode,codeDiff,feasible,budgetFor,dishTime,rngFrom,rollOut};
/* ================= GAME ================= */
if(typeof document!=='undefined'){
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
/* ---- chef looks: man or woman is fixed when the chef is made; clothes colours can change any time ---- */
const CLOTH=[['White','#f4f1ea'],['Charcoal','#2f343b'],['Red','#c8423f'],['Blue','#2f6fb3'],['Green','#2e8b57'],['Purple','#7a4fb5'],['Pink','#e377a7'],['Orange','#e58a2b'],['Teal','#1f9aa0'],['Yellow','#e2b93b']];
const AILOOK={vex:{g:'m',j:1,a:2},sato:{g:'w',j:0,a:3},costa:{g:'w',j:2,a:0},oke:{g:'m',j:5,a:1},hal:{g:'w',j:4,a:9}};
const cleanLook=o=>{o=o&&typeof o==='object'?o:{};const ix=v=>Number.isInteger(v)&&v>=0&&v<CLOTH.length;return{g:o.g==='m'||o.g==='w'?o.g:'',j:ix(o.j)?o.j:0,a:ix(o.a)?o.a:1}};
function avatar(look,size){const L=cleanLook(look),j=CLOTH[L.j][1],a=CLOTH[L.a][1],hair='#3b2a22',skin='#e0b08a',edge='#8d969e';
  return `<svg class="avatar" viewBox="0 0 64 72" width="${size}" height="${Math.round(size*1.125)}" role="img" aria-label="${L.g==='w'?'Woman chef':L.g==='m'?'Man chef':'Chef'}">
  ${L.g==='w'?`<path d="M17 30c-3 9-3 18 1 24h28c4-6 4-15 1-24z" fill="${hair}"/>`:''}
  <path d="M6 72c0-14 10-21 26-21s26 7 26 21z" fill="${j}" stroke="${edge}" stroke-width="1"/>
  <path d="M26 51l6 7 6-7" fill="none" stroke="${edge}" stroke-width="1.2"/>
  <path d="M21 72V61h22v11z" fill="${a}" stroke="${edge}" stroke-width="1"/><path d="M21 61l5-9M43 61l-5-9" stroke="${a}" stroke-width="2" fill="none"/>
  <rect x="28" y="43" width="8" height="9" fill="${skin}"/><circle cx="32" cy="34" r="12" fill="${skin}"/>
  ${L.g==='w'?`<path d="M20 34c0-7 4-10 12-10s12 3 12 10c-3-3-6-5-12-5s-9 2-12 5z" fill="${hair}"/>`:`<path d="M20 33c0-6 4-9 12-9s12 3 12 9l-2-4H22z" fill="${hair}"/>`}
  <circle cx="27.5" cy="36" r="1.4" fill="#2a2420"/><circle cx="36.5" cy="36" r="1.4" fill="#2a2420"/><path d="M28 40.5c2.5 2 5.5 2 8 0" fill="none" stroke="#2a2420" stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="23" cy="13" r="7" fill="#fff" stroke="${edge}"/><circle cx="41" cy="13" r="7" fill="#fff" stroke="${edge}"/><circle cx="32" cy="10" r="8.5" fill="#fff" stroke="${edge}"/>
  <rect x="20" y="15" width="24" height="10" rx="2" fill="#fff" stroke="${edge}"/><path d="M21 16h22" stroke="#fff" stroke-width="3"/></svg>`}
const GAME_URL='https://jtrh41.github.io/last-plate/';
function qrSvg(text){try{if(typeof qrcode!=='function')return '';const q=qrcode(0,'M');q.addData(text);q.make();const n=q.getModuleCount();let d='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))d+='M'+x+' '+y+'h1v1h-1z';
  return `<svg viewBox="0 0 ${n} ${n}" role="img" aria-label="QR code for ${text}" shape-rendering="crispEdges"><path d="${d}" fill="#000"/></svg>`}catch(e){return ''}}
function swatches(act,cur,label){return `<span class="small mute">${label}: ${CLOTH[cur][0]}</span><div class="swrow">${CLOTH.map((c,i)=>`<button class="sw" data-a="${act}" data-i="${i}" aria-pressed="${cur===i}" aria-label="${label} ${c[0]}" style="background:${c[1]}"></button>`).join('')}</div>`}
/* ---- saves: one record per named chef, kept on this device ---- */
const KEY='lastplate2';
let ST={cur:'',chefs:{}},saveErr=false;
try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j&&j.chefs&&typeof j.chefs==='object'&&!Array.isArray(j.chefs))ST={cur:String(j.cur||''),chefs:j.chefs}}catch(e){}
const rid=n=>Array.from({length:n},()=>ALPHA[Math.floor(Math.random()*32)]).join('').toLowerCase();
const cleanName=s=>String(s||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,14);
const blank=name=>({name,pid:rid(10),cleared:{},lvl:0,diff:2,cash:0,played:0,best:0,known:{},perk:'knives',pressure:false,match:null,look:{g:'',j:0,a:1}});
function cleanChef(o){if(!o||typeof o!=='object')return null;const c=blank(cleanName(o.name)||'Chef');
  if(o.cleared&&typeof o.cleared==='object')for(let l=0;l<50;l++){const v=o.cleared[l];if(Number.isInteger(v)&&v>=1&&v<=6)c.cleared[l]=v}
  if(o.known&&typeof o.known==='object')for(const k of Object.keys(o.known).slice(0,4000)){const[a,b]=k.split('|');if(has(I,a)&&has(T,b||''))c.known[k]=1}
  c.cash=clamp(Math.floor(+o.cash||0),0,1e9);c.played=clamp(Math.floor(+o.played||0),0,1e6);c.best=clamp(+o.best||0,0,90);c.diff=[0,1,2,3,4,5].includes(o.diff)?o.diff:2;
  c.perk=has(PERKS,o.perk)?o.perk:'knives';c.pressure=!!o.pressure;c.look=cleanLook(o.look);return c}
for(const id of Object.keys(ST.chefs)){const m=ST.chefs[id]&&ST.chefs[id].match,pid=ST.chefs[id]&&ST.chefs[id].pid,c=cleanChef(ST.chefs[id]);if(!c||!/^[a-z0-9]{4,12}$/.test(id)){delete ST.chefs[id];continue}
  if(typeof pid==='string'&&/^[a-z0-9]{10}$/.test(pid))c.pid=pid;c.lvl=clamp(Math.floor(+ST.chefs[id].lvl||0),0,49);c.match=m&&typeof m==='object'?m:null;ST.chefs[id]=c}
let S=ST.chefs[ST.cur]||null;
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(ST));saveErr=false}catch(e){saveErr=true}};
const chefCode=c=>{const o=Object.assign({},c,{match:null,pid:undefined}),body=B64.enc(JSON.stringify(o));return 'LPS1.'+body+'.'+hash(body).toString(36)};
function readChefCode(str){try{const m=String(str).trim().match(/^LPS1\.([\w-]+)\.([a-z0-9]+)$/);if(!m||hash(m[1]).toString(36)!==m[2])return null;return cleanChef(JSON.parse(B64.dec(m[1])))}catch(e){return null}}
const totalWins=()=>Object.keys(S.cleared).length,lvlOpen=l=>l===0||!!S.cleared[l-1];
const DAB=['VE','E','N','H','VH','X'];
let screen=S&&Object.keys(ST.chefs).length===1?'menu':'chefs',M=null,KC=null,P=null,SV=null,RES=null,sheet=null,stage=0,joinErr='',chefErr='',delId='',showBackup=false,tick=null,deadline=0,draft={name:'',look:{g:'',j:0,a:1}};
let DB=null,unsub=null,live={on:false,err:false},writeQ=Promise.resolve();
const K=()=>KC||(KC=makeCfg(M.lvl,M.diff));
/* ---- match set-up ---- */
function validPerk(){return PERKS[S.perk]&&totalWins()>=PERKS[S.perk].wins?S.perk:'knives'}
function newMatch(mode,lvl,diff,code){const seed=mode==='duel'?'duel:'+code:'solo:'+Date.now()+':'+Math.random();KC=null;
  M={mode,lvl,diff,code:code||'',seed,perk:validPerk(),round:0,judges:pickJudges(seed),chefs:null,alive:null,dishes:{me:[],opp:[]},totals:{},fin:null};
  const rivals=pickRivals(seed,mode==='duel'?2:3);
  M.chefs=[{id:'me',name:S.name,human:1}].concat(mode==='duel'?[{id:'opp',name:'Rival chef',human:1}]:[],rivals.map(c=>({id:c.id,name:c.name,tag:c.tag,style:c.style})));
  M.alive=M.chefs.map(c=>c.id);persist();if(mode==='duel')liveStart();go('intro')}
function persist(){S.match=M?{mode:M.mode,lvl:M.lvl,diff:M.diff,code:M.code,seed:M.seed,perk:M.perk,round:M.round,judges:M.judges,chefs:M.chefs,alive:M.alive,dishes:M.dishes,totals:M.totals,oppId:M.oppId,oppSeen:M.oppSeen,oppLook:M.oppLook}:null;save()}
function okMatch(m){try{return m&&(m.mode==='solo'||(m.mode==='duel'&&okCode(m.code)))&&Number.isInteger(m.lvl)&&m.lvl>=-1&&m.lvl<50&&[0,1,2,3,4,5].includes(m.diff)&&typeof m.seed==='string'&&[0,1,2,3].includes(m.round)&&
  Array.isArray(m.judges)&&m.judges.length===3&&m.judges.every(j=>Number.isInteger(j)&&j>=0&&j<JUDGES.length)&&Array.isArray(m.chefs)&&m.chefs.every(c=>c&&(c.id==='me'||c.id==='opp'||AI.some(a=>a.id===c.id)))&&Array.isArray(m.alive)&&m.dishes&&Array.isArray(m.dishes.me)&&Array.isArray(m.dishes.opp)&&m.totals&&typeof m.totals==='object'}catch(e){return false}}
const basketOf=r=>pickBasket(M.seed,r,K());
const basket=()=>basketOf(M.round),budget=()=>budgetFor(M.round,K());
function dishOf(id,round){if(id==='me'||id==='opp')return M.dishes[id][round]||null;return aiDish(M.seed,M.chefs.find(c=>c.id===id),round,K(),M.judges)}
function scoreOf(id,round){const d=dishOf(id,round);return d?scoreDish(d,basketOf(round),round,M.judges):null}
/* ---- live head-to-head (only where the page has a shared store) ---- */
function liveStart(){if(!DB||unsub||!M||M.mode!=='duel')return;try{
  unsub=DB.collection('duels/'+M.code+'/p').onSnapshot(snap=>{live.on=true;let found=null;for(const doc of snap.docs){if(doc.id===S.pid)continue;if(M.oppId&&doc.id!==M.oppId)continue;found=doc;break}
    if(found){M.oppId=found.id;takeOpp(found.data())}soft()},()=>{live.err=true;live.on=false;unsub=null;soft()});livePush()}catch(e){live.err=true}}
function liveStop(){if(unsub){try{unsub()}catch(e){}unsub=null}live.on=false}
function livePush(){if(!DB||!M||M.mode!=='duel')return;const body={n:S.name,l:S.look,k:M.perk,d:JSON.parse(JSON.stringify(M.dishes.me)),t:Date.now()},path='duels/'+M.code+'/p/'+S.pid;
  writeQ=writeQ.then(()=>DB.doc(path).set(body)).catch(()=>{live.err=true;soft()})}
function takeOpp(e){if(!e||typeof e!=='object')return false;const name=cleanName(e.n),perk=typeof e.k==='string'?e.k:'';
  const ds=[];for(let r=0;r<3;r++){const d=cleanDish(Array.isArray(e.d)?e.d[r]:null,r,K(),perk);if(!d)break;ds.push(d)}
  if(name)M.chefs.find(c=>c.id==='opp').name=name;if(e.l)M.oppLook=cleanLook(e.l);if(ds.length>M.dishes.opp.length)M.dishes.opp=ds;M.oppSeen=true;persist();return true}
function soft(){if(!M)return;if(screen==='final'&&M.mode==='duel'&&M.dishes.opp.length>=3){endDuel();return}if(['judging','final','lobby','intro'].includes(screen)&&!sheet)render();else{const p=$('#livepill');if(p)p.outerHTML=livePill()}}
function livePill(){if(!M||M.mode!=='duel')return '';const opp=M.chefs.find(c=>c.id==='opp');
  return live.on?`<span id="livepill" class="pill on">Live${M.oppSeen?' with '+esc(opp.name):', waiting for rival'}</span>`:`<span id="livepill" class="pill">Not live. Swap codes at the end</span>`}
if(window.claude&&window.claude.use)window.claude.use('db').then(d=>{DB=d;if(d)liveStart()}).catch(()=>{});
/* ---- navigation ---- */
function go(s){screen=s;stage=0;sheet=null;clearInterval(tick);tick=null;
  if(s==='plan'){P={comps:[{role:'main',ings:[],tech:null,pace:1,out:2}],fin:[],plate:1,left:0};if(S.pressure){deadline=Date.now()+budget()*6000;tick=setInterval(pressTick,500)}}
  render();window.scrollTo(0,0)}
function pressTick(){const left=Math.max(0,deadline-Date.now()),el=$('#press');if(el)el.textContent=fmtSec(left);if(left<=0){clearInterval(tick);tick=null;sheet=null;
  P.comps=P.comps.filter(c=>c.ings.length&&c.tech);P.plate=0;while(P.comps.length&&!feasible(P,budget(),M.perk))P.comps.pop();fire(true)}}
const fmtSec=ms=>{const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
/* ---- rendering ---- */
const ing=id=>I[id];
function tile(id,cls,act,extra){const i=ing(id);return `<button class="tile ${cls||''}" data-a="${act}" data-id="${id}"><span class="em">${i.em}</span><span>${i.name}</span>${i.odd?'<span class="odd">oddball</span>':''}${extra||''}</button>`}
const bgrid=(ids,f)=>`<div class="basket" style="grid-template-columns:repeat(${ids.length>4?5:4},1fr)">${ids.map(f).join('')}</div>`;
function flBars(v,ci){return '<div class="fl">'+AX.map((n,j)=>{const[lo,hi]=COURSES[ci].tg[j],out=v&&(v[j]<lo-.15||v[j]>hi+.15);return `<span>${n}</span><span class="tr"><i class="band" style="left:${lo*20}%;width:${(hi-lo)*20}%"></i>${v?`<i class="dot ${out?'out':''}" style="left:${clamp(v[j]*20,2,98)}%"></i>`:''}</span>`}).join('')+'</div>'}
function knows(id,t){return K().reveal||M.perk==='palate'||ing(id).pantry||S.known[id+'|'+t]}
function fitTag(id,t){if(!knows(id,t))return '<span class="tag mute">untested</span>';const a=aff(ing(id),T[t]);return `<span class="tag ${a>=3?'good':a===2?'cool':a===1?'warm':'bad'}">${FITNAME[a]}</span>`}
function render(){const el=$('#app');el.innerHTML=({chefs:vChefs,menu:vMenu,lobby:vLobby,intro:vIntro,basket:vBasket,plan:vPlan,service:vService,judging:vJudging,final:vFinal})[screen]();$('#sheet').innerHTML=sheet?vSheet():'';document.body.classList.toggle('noscroll',!!sheet)}
const lookOf=c=>c.id==='me'?S.look:c.id==='opp'?(M.oppLook||{g:'',j:1,a:0}):AILOOK[c.id];
const IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),INSTALLED=navigator.standalone===true||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches),HOSTED=!!(window.claude&&window.claude.use);
function vChefs(){const ids=Object.keys(ST.chefs);return `
 <header class="col" style="gap:6px;padding-top:10px"><span class="eyebrow">Mystery basket cooking tournament</span><h1>Last<br>Plate</h1></header>
 <h2>${ids.length?'Who is cooking?':'Name your chef'}</h2>
 ${ids.length?`<div class="col">${ids.map(id=>{const c=ST.chefs[id],n=Object.keys(c.cleared).length;return `<div class="row" style="flex-wrap:nowrap">${avatar(c.look,46)}<button class="trow" data-a="chef" data-id="${id}" style="flex:1;min-width:0"><b>${esc(c.name)}</b><span class="mono small">$${c.cash.toLocaleString()}</span><span class="small mute">${n} of 50 levels cleared${c.match?' · match in progress':''}</span></button>
   <button class="btn ghost" data-a="delchef" data-id="${id}" style="font-size:13px;padding:8px 10px">${delId===id?'Tap again to delete':'Delete'}</button></div>`}).join('')}</div>`:'<p class="mute">Each chef has their own career, winnings and notebook. Everything saves by itself on this device.</p>'}
 <section class="panel"><h3>New chef</h3>
  <div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:14px">${avatar(draft.look,84)}<div class="col" style="flex:1;min-width:0">
   <label class="small mute" for="nm">Name on the ticket (up to 14 characters)</label><input type="text" id="nm" maxlength="14" placeholder="Chef name" autocomplete="off" autocorrect="off" enterkeyhint="done" value="${esc(draft.name)}">
   <div class="seg"><button data-a="ng" data-v="w" aria-pressed="${draft.look.g==='w'}">Woman</button><button data-a="ng" data-v="m" aria-pressed="${draft.look.g==='m'}">Man</button></div>
   <span class="small mute">This choice is permanent for the chef. Clothes can be recoloured any time.</span></div></div>
  ${swatches('nj',draft.look.j,'Jacket')}${swatches('na',draft.look.a,'Apron')}
  ${chefErr?`<p class="small bad">${chefErr}</p>`:''}
  <button class="btn go wide" data-a="addchef">Add chef</button></section>
 ${IOS&&!INSTALLED&&!HOSTED?'<section class="panel"><h3>Put it on your Home Screen first</h3><p class="small">In Safari, tap the Share button, then <b>Add to Home Screen</b>, and open Last Plate from the new icon. The Home Screen app keeps its own saves and works offline. Chefs made here in Safari do not carry over, and Safari may clear them after a week unused.</p></section>':''}
 <button class="btn wide" data-a="share">Share the game with a QR code</button>
 <section class="panel"><h3>Restore a chef from a backup code</h3><textarea id="restore" placeholder="Paste a backup code that starts with LPS1."></textarea><button class="btn" data-a="restore">Restore</button></section>
 ${saveErr?'<p class="small bad">This browser is refusing to store data, so progress will not be kept. Check that private browsing is off.</p>':''}`}
function vMenu(){const m=okMatch(S.match)?S.match:null,cur=makeCfg(S.lvl,S.diff),n=totalWins(),D=DIFFS[S.diff];return `
 <header class="col" style="gap:6px;padding-top:6px"><div class="row" style="flex-wrap:nowrap;gap:14px">${avatar(S.look,72)}<div class="col" style="gap:6px;min-width:0"><span class="eyebrow">Chef ${esc(S.name)}</span><div class="row" style="gap:8px"><button class="btn" style="min-height:44px;padding:6px 12px;font-size:13px" data-a="look">Change clothes</button><button class="btn ghost" style="min-height:44px;padding:6px 12px;font-size:13px" data-a="switch">Switch chef</button><button class="btn ghost" style="min-height:44px;padding:6px 12px;font-size:13px" data-a="share">Share game</button></div></div></div><h1 style="font-size:clamp(44px,13vw,80px)">Last Plate</h1></header>
 ${m?`<button class="btn go wide" data-a="resume">Resume ${m.mode==='duel'?'head-to-head '+esc(m.code):'level '+(m.lvl+1)}: ${m.round>2?'result':COURSES[m.round].name}</button>`:''}
 <section class="panel"><div class="row" style="justify-content:space-between"><h3>Career</h3><span class="mono small mute">${n} of 50 cleared</span></div>
  ${VENUES.map((v,vi)=>`<div class="col" style="gap:4px"><span class="small ${lvlOpen(vi*5)?'':'mute'}">${v}</span><div class="lvgrid">${[0,1,2,3,4].map(k=>{const l=vi*5+k,c=S.cleared[l];return `<button class="lv ${c?'done':''}" data-a="lvl" data-i="${l}" aria-pressed="${S.lvl===l}" ${lvlOpen(l)?'':'disabled'} aria-label="Level ${l+1}${c?', cleared on '+DIFFS[c-1].name:''}">${k===4?'F':l+1}<small>${c?DAB[c-1]:'&nbsp;'}</small></button>`}).join('')}</div></div>`).join('')}
  <p class="small mute">Win a level on any difficulty to open the next. The letters show the hardest setting you have cleared it on.</p></section>
 <section class="panel"><span class="eyebrow">Level ${S.lvl+1} of 50</span><h3>${cur.name}</h3>
  <div class="seg">${DIFFS.map((d,i)=>`<button data-a="diff" data-i="${i}" aria-pressed="${S.diff===i}">${d.name}</button>`).join('')}</div>
  <ul class="small" style="margin:0;padding-left:18px">${cur.twists.concat(['Rival chefs '+['barely plan','plan a little','plan sensibly','plan well','plan very well','plan relentlessly'][S.diff]+(D.myRisk<1?', and your cooking is more forgiving':D.myRisk>1?', and your cooking is less forgiving':''),'Prize $'+cur.prize.toLocaleString()]).map(t=>`<li>${t}</li>`).join('')}</ul>
  <h3 style="margin-top:6px">Your edge</h3>
  <div class="col">${Object.entries(PERKS).map(([k,p])=>{const open=n>=p.wins;return `<button class="trow ${open?'':'lock'}" data-a="perk" data-id="${k}" aria-pressed="${validPerk()===k}" ${open?'':'disabled'}><b>${p.name}</b><span></span><span class="small mute">${open?p.text:'Unlocks after '+p.wins+' levels cleared.'}</span></button>`}).join('')}</div>
  <div class="row"><div class="seg"><button data-a="press" data-v="0" aria-pressed="${!S.pressure}">Think freely</button><button data-a="press" data-v="1" aria-pressed="${S.pressure}">Pressure clock</button></div><span class="small mute">Pressure clock: 6 real seconds per kitchen minute.</span></div>
  <button class="btn go wide" data-a="solo">Enter the kitchen</button></section>
 <section class="panel"><h3>Head-to-head on two devices</h3>
  <p class="small mute">You and a rival cook the same three baskets for the same judges, each on your own device. Two house chefs fill the line and are cut along the way. Highest combined score over three courses wins. A new match uses the difficulty picked above (${D.name}).</p>
  <div class="grid2"><button class="btn" data-a="host">Start a match</button>
  <div class="row" style="flex-wrap:nowrap"><input type="text" id="jc" maxlength="5" placeholder="CODE" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase"><button class="btn" data-a="join">Join</button></div></div>
  ${joinErr?`<p class="small bad">${joinErr}</p>`:''}</section>
 <section class="panel"><h3>Save</h3><p class="small ${saveErr?'bad':'mute'}">${saveErr?'This browser is refusing to store data, so progress is not being kept. Check that private browsing is off.':'Your career saves by itself on this device after every course. A backup code lets you restore this chef later or move to another device.'}</p>
  ${showBackup?`<textarea id="mycode" readonly>${chefCode(S)}</textarea><button class="btn" data-a="copy">Copy backup code</button>`:'<button class="btn" data-a="backup">Show backup code</button>'}</section>
 <p class="small mute mono">Played ${S.played} · Winnings $${S.cash.toLocaleString()} · Best plate ${S.best}/90 · ${Object.keys(S.known).length} pairings learned</p>`}
function vLobby(){return `<span class="eyebrow">Head-to-head · ${DIFFS[M.diff].name}</span><h2>Match code</h2><div class="code">${esc(M.code)}</div>
 <p class="mute">Your rival opens Last Plate on their device, taps Join and types this code. You both get the same baskets and judges. You do not need to start at the same moment.</p>
 <div class="row">${livePill()}</div>
 <p class="small mute">${DB?'When you are both connected, each plate appears on the other device as soon as it is sent.':'After dessert you each get a result code to send to the other. Paste it in and the game names the winner.'}</p>
 <button class="btn go wide" data-a="to" data-s="intro">Continue</button><button class="btn ghost" data-a="quit">Back to menu</button>`}
function vIntro(){const k=K();return `<span class="eyebrow">${M.mode==='duel'?'Head-to-head '+esc(M.code):'Level '+(M.lvl+1)+' · '+DIFFS[M.diff].name}</span><h2>${M.mode==='duel'?'Meet the panel':k.name}</h2>
 ${k.twists.length?`<div class="panel"><h3>House rules</h3><ul class="small" style="margin:0;padding-left:18px">${k.twists.map(t=>`<li>${t}</li>`).join('')}</ul></div>`:''}
 <p class="mute">The same three judges score every round. Each gives up to 10 for taste, 10 for creativity and 10 for presentation. Cook for them.</p>
 <div class="col">${M.judges.map(j=>`<div class="panel"><div class="row" style="justify-content:space-between"><h3>${JUDGES[j].name}</h3><span class="tag warm">${JUDGES[j].tag}</span></div><p class="small">${JUDGES[j].bio}</p></div>`).join('')}</div>
 <h2 style="margin-top:6px">On the line</h2>
 <div class="col">${M.chefs.filter(c=>c.id!=='me').map(c=>`<div class="panel"><div class="row" style="gap:10px;flex-wrap:nowrap">${avatar(lookOf(c),40)}<h3>${esc(c.name)}</h3></div><p class="small mute">${c.human?'Your rival, on another device. '+(M.oppSeen?'Connected.':'Not seen yet.'):c.tag}</p></div>`).join('')}</div>
 <div class="row">${livePill()}</div>
 <div class="foot"><button class="btn go wide" data-a="to" data-s="basket">Open the first basket</button></div>`}
function vBasket(){const C=COURSES[M.round],b=basket();return `<span class="eyebrow">Round ${M.round+1} of 3 · ${M.alive.length} chefs left</span><h2>${C.name}</h2>
 <div style="text-align:center"><div class="lid">🧺</div></div>
 <div style="perspective:600px">${bgrid(b,id=>tile(id,'flip','info'))}</div>
 <p>${C.brief}</p>
 <div class="panel"><div class="row" style="justify-content:space-between"><h3>The clock</h3><span class="mono warm" style="font-size:22px">${budget()}:00</span></div>
 <p class="small mute">Every basket ingredient must be on the plate. Hands-on minutes add up across your components. Ovens, pickles and ice cream machines run on their own, but they still have to finish before time is called.</p>
 ${K().ban.length?`<p class="small bad">Station down: you cannot ${K().ban.map(t=>T[t].verb).join(' or ')}.</p>`:''}${K().short.length?`<p class="small bad">Missing from the pantry: ${K().short.map(id=>ing(id).name.toLowerCase()).join(', ')}.</p>`:''}</div>
 <div class="foot"><button class="btn go wide" data-a="to" data-s="plan">Start cooking</button></div>`}
function planStats(){const b=budget(),x=dishTime(P,M.perk),ready=P.comps.length>0&&P.comps.every(c=>c.ings.length&&c.tech);
  const usedIds=new Set(P.comps.flatMap(c=>c.ings)),unused=basket().filter(id=>!usedIds.has(id));
  return{b,a:x.a,long:x.long,ready,unused,ok:ready&&x.a<=b&&x.long<=b}}
function riskTag(c){if(!c.tech||!c.ings.length)return '';if(!knows(c.ings[0],c.tech))return '<span class="tag mute">risk unknown</span>';const p=pFail(c,K().myRisk);return `<span class="tag ${p<.12?'good':p<.3?'cool':p<.6?'warm':'bad'}">${p<.12?'low risk':p<.3?'some risk':p<.6?'risky':'reckless'}</span>`}
function vPlan(){const st=planStats(),C=COURSES[M.round],b=basket(),usedIds=new Set(P.comps.flatMap(c=>c.ings));
 const v=P.comps.some(c=>c.ings.length&&c.tech)?dishVec({comps:P.comps.filter(c=>c.ings.length&&c.tech),fin:P.fin}):null,left=st.b-st.a;
 return `<div class="rail"><div class="clock ${left<0?'over':''}">${left}<span style="font-size:14px">m</span></div>
  <div class="meta"><div class="row" style="justify-content:space-between;gap:6px"><span class="small"><b>${C.name}</b> · hands-on minutes left</span>${S.pressure?`<span class="mono bad" id="press">${fmtSec(Math.max(0,deadline-Date.now()))}</span>`:livePill()}</div>
  <div class="bar"><i class="${left<0?'over':''}" style="width:${clamp(st.a/st.b*100,0,100)}%"></i></div>
  <span class="small mono ${st.long>st.b?'bad':'mute'}">Longest cook finishes at ${st.long} of ${st.b} min</span></div></div>
 ${bgrid(b,id=>tile(id,usedIds.has(id)?'used':'','info'))}
 <section class="panel"><div class="row" style="justify-content:space-between"><h3>How it will taste</h3><span class="small mute">green band = what a ${C.name.toLowerCase()} wants</span></div>${flBars(v,M.round)}</section>
 ${P.comps.map((c,i)=>{const t=c.tech&&T[c.tech],tm=compTime(c,M.perk);return `<section class="panel comp">
  <div class="row" style="justify-content:space-between"><div class="seg">${Object.entries(ROLES).map(([k,r])=>`<button data-a="role" data-i="${i}" data-v="${k}" aria-pressed="${c.role===k}">${r.name}</button>`).join('')}</div>${P.comps.length>1?`<button class="btn ghost" style="min-height:38px;padding:6px 12px" data-a="delc" data-i="${i}" aria-label="Remove component">Remove</button>`:''}</div>
  <div class="row">${c.ings.map((id,k)=>`<button class="chip ${k?'':'lead'} ${ing(id).pantry?'':'b'}" data-a="chip" data-i="${i}" data-k="${k}" title="${k?'Tap to make this the lead':'Lead ingredient. Tap to remove'}">${ing(id).em} ${ing(id).name}${k?'':' <span class="x">lead</span>'}</button>`).join('')}
   ${c.ings.length<3?`<button class="chip" data-a="pick" data-i="${i}">+ ingredient</button>`:''}</div>
  <div class="row"><button class="btn" data-a="tech" data-i="${i}" ${c.ings.length?'':'disabled'}>${t?t.name:'Choose a technique'}</button>
   <div class="seg">${['Rush','Steady','Careful'].map((n,k)=>`<button data-a="pace" data-i="${i}" data-v="${k}" aria-pressed="${c.pace===k}">${n}</button>`).join('')}</div></div>
  ${t?`<div class="stat"><span>${tm.a} min hands-on${tm.p?' + '+tm.p+' unattended':''}</span>${fitTag(c.ings[0],c.tech)}${riskTag(c)}<span>${['','simple cooking','transforms it'][t.lvl]||'untouched'}</span></div>`:`<p class="small mute">${c.ings.length?'The lead ingredient decides whether the technique works.':'Add up to three ingredients. The first one leads.'}</p>`}
 </section>`}).join('')}
 ${P.comps.length<4?'<button class="btn wide" data-a="addc">+ Add a component</button>':''}
 <section class="panel"><h3>Finish and plate</h3><div class="row">${Object.entries(FIN).map(([k,f])=>`<button class="chip" data-a="fin" data-id="${k}" aria-pressed="${P.fin.includes(k)}">${f.name}</button>`).join('')}</div><p class="small mute">Up to three finishing touches. They cost no time.</p>
  <div class="seg">${PLATE.map((p,k)=>`<button data-a="plate" data-v="${k}" aria-pressed="${P.plate===k}">${p.name} · ${plateMin({plate:k},M.perk)} min</button>`).join('')}</div></section>
 <div class="foot">${st.unused.length?`<p class="small bad">Not on the plate yet: ${st.unused.map(id=>ing(id).name).join(', ')}</p>`:''}
  ${st.ready&&!st.ok?`<p class="small bad">${st.a>st.b?'You are '+(st.a-st.b)+' hands-on minutes over.':'Something will not finish before time is called.'} Rush a step, simplify the plating or drop a component.</p>`:''}
  <button class="btn go wide" data-a="fire" ${st.ok?'':'disabled'}>${st.ok?(st.unused.length?'Fire it anyway':'Fire the dish'):st.ready?'Over time':'Finish every component'}</button></div>`}
function vSheet(){const s=sheet;let h='';
 if(s.t==='info'){const i=ing(s.id),kn=TECH.filter(t=>knows(s.id,t.id));h=`<div class="row" style="justify-content:space-between"><h2>${i.em} ${i.name}</h2><button class="btn" data-a="close">Close</button></div>
  <p class="mute small">${CATNAME[i.cat]}${i.odd?' · oddball':''} · ${i.tex}</p><p>${i.hint}</p>
  <div class="fl">${AX.map((n,j)=>`<span>${n}</span><span class="tr"><i class="band" style="left:0;width:${i.f[j]*20}%"></i></span>`).join('')}</div>
  <h3>What you know</h3>${kn.length?`<div class="row">${kn.map(t=>`<span class="chip">${t.name} ${fitTag(s.id,t.id)}</span>`).join('')}</div>`:'<p class="small mute">Nothing yet. Cook it and your notebook remembers how each technique went.</p>'}`}
 if(s.t==='share'){const q=qrSvg(GAME_URL);h=`<div class="row" style="justify-content:space-between"><h2>Share the game</h2><button class="btn go" style="min-height:44px;font-size:18px" data-a="close">Done</button></div>
  ${q?`<div class="qr">${q}</div><p style="text-align:center">Point a phone camera at this code and tap the link that appears.</p>`:''}
  <p class="url" id="gameurl">${GAME_URL}</p>
  <div class="grid2">${navigator.share&&!HOSTED?'<button class="btn" data-a="sendlink">Send the link</button>':''}<button class="btn" data-a="copylink">Copy the link</button></div>
  <div class="panel"><h3>On an iPhone</h3><ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px"><li>Scan the code with the Camera app. The game opens in Safari.</li><li>Tap the Share button, then <b>Add to Home Screen</b>.</li><li>Open Last Plate from the new icon and add your chef there.</li></ol></div>
  <p class="small mute">Each phone keeps its own chefs and saves. To cook against each other, one of you taps Start a match and the other joins with the code.</p>`}
 if(s.t==='look'){h=`<div class="row" style="justify-content:space-between"><h2>Chef ${esc(S.name)}</h2><button class="btn go" style="min-height:44px;font-size:18px" data-a="close">Done</button></div>
  <div style="display:flex;justify-content:center">${avatar(S.look,120)}</div>
  ${S.look.g?'':`<div class="seg"><button data-a="sg" data-v="w">Woman</button><button data-a="sg" data-v="m">Man</button></div><span class="small mute">Pick once. This cannot be changed afterwards.</span>`}
  ${swatches('sj',S.look.j,'Jacket')}${swatches('sa',S.look.a,'Apron')}<p class="small mute">Saved as you tap.</p>`}
 if(s.t==='pick'){const c=P.comps[s.i],b=basket();h=`<div class="row" style="justify-content:space-between"><h2>Add ingredients</h2><button class="btn go" style="min-height:44px;font-size:18px" data-a="close">Done</button></div>
  <p class="small mute">Up to three per component. The first one you add leads.</p><h3>Basket</h3>${bgrid(b,id=>tile(id,c.ings.includes(id)?'sel':'','add'))}
  <h3>Pantry</h3><div class="pgrid">${PANTRY.filter(id=>!K().short.includes(id)).map(id=>tile(id,c.ings.includes(id)?'sel':'','add')).join('')}</div>`}
 if(s.t==='tech'){const c=P.comps[s.i],lead=c.ings[0];h=`<div class="row" style="justify-content:space-between"><h2>Technique</h2><button class="btn" data-a="close">Close</button></div>
  <p class="small mute">For ${ing(lead).em} ${ing(lead).name}. Times are hands-on + unattended minutes at a steady pace.</p>
  <div class="col">${TECH.map(t=>{const ban=K().ban.includes(t.id);return `<button class="trow ${ban?'lock':''}" data-a="settech" data-i="${s.i}" data-id="${t.id}" aria-pressed="${c.tech===t.id}" ${ban?'disabled':''}><b>${t.name}</b><span class="mono small">${t.a}${t.p?' + '+t.p:''} min</span><span class="small mute">${ban?'Station down for this level':['Leaves it as it is','Simple cooking','Transforms the ingredient'][t.lvl]}</span>${ban?'<span></span>':fitTag(lead,t.id)}</button>`}).join('')}</div>`}
 return `<div class="scrim" data-a="scrim"><div class="sheet" role="dialog" aria-modal="true">${h}</div></div>`}
const OUT=[['Ruined','bad'],['Flawed','warm'],['Good','cool'],['Perfect','good']];
function vService(){const done=SV.i>=P.comps.length;return `<div class="rail"><div class="clock">${SV.left}<span style="font-size:14px">m</span></div><div class="meta"><span class="small"><b>Service</b> · minutes in hand</span><span class="small mute mono">${done?'Everything is off the heat.':'Cooking…'}</span></div></div>
 <h2>${done?'Hands up':'On the heat'}</h2>
 ${P.comps.map((c,i)=>{const st=i<SV.i?'done':i===SV.i?'cooking':'wait',o=OUT[c.out],cost=refireCost(c),can=st==='done'&&done&&c.out<=1&&cost<=SV.left&&T[c.tech].p<10;
  return `<section class="panel line ${st}"><div><b>${esc(phrase(c,basket()))}</b><div class="small mute">${ROLES[c.role].name}</div></div>
   ${st==='done'?`<span class="tag ${o[1]}">${o[0]}</span>`:`<span class="tag mute">${st==='cooking'?'cooking':'waiting'}</span>`}
   <div class="bar"><i style="width:${st==='done'?100:0}%"></i></div>
   ${st==='done'&&c.out<=1?`<span class="small ${o[1]}">It came out ${T[c.tech].flaw}.</span>${can?`<button class="btn" data-a="refire" data-i="${i}">Re-fire · ${cost} min</button>`:`<span class="small mute">${done?(T[c.tech].p>=10?'No time to start that again.':'Not enough minutes to re-fire.'):''}</span>`}`:''}
  </section>`}).join('')}
 ${done?`<div class="foot"><button class="btn go wide" data-a="serve">Send it to the judges</button></div>`:''}`}
function refireCost(c){return Math.max(1,Math.ceil(compTime(c,M.perk).a*(M.perk==='cool'?.5:1)))}
function initials(n){return n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
function ticket(row,reveal){const c=row.chef,sc=row.sc;
 if(!sc)return `<article class="ticket"><h3>${esc(c.name)}</h3><p class="mute">Still cooking on the other device. Their plate will appear here.</p></article>`;
 return `<article class="ticket ${c.id==='me'?'me':''} ${reveal&&row.cut?'cut':''}">${reveal&&row.cut?'<span class="stamp">Cut</span>':reveal&&row.win?'<span class="stamp win">Winner</span>':''}
  <div class="row" style="justify-content:space-between;padding-right:${reveal&&(row.cut||row.win)?'104px':'0'}"><div class="row" style="gap:8px;flex-wrap:nowrap;min-width:0">${avatar(lookOf(c),34)}<h3>${esc(c.name)}${c.id==='me'?' (you)':''}</h3></div>${reveal?`<span class="tot">${sc.total}<span style="font-size:16px">/90</span></span>`:''}</div>
  <p class="dish">${esc(dishTitle(row.dish,basketOf(row.round)))}</p>
  <p class="small mute">${PLATE[row.dish.plate].name} plating${row.dish.fin.length?' · '+row.dish.fin.map(f=>FIN[f].name.toLowerCase()).join(', '):''}</p><div class="hr"></div>
  ${sc.judges.map(j=>{const J=JUDGES.find(x=>x.id===j.id);return `<div class="jr"><span class="av">${initials(J.name)}</span><span>${c.id==='me'||reveal?j.say.map(esc).join(' '):esc(j.say[0])}</span>${reveal?`<span class="sc">${j.total}<br><span class="mute" style="font-weight:400">${j.t}·${j.c}·${j.p}</span></span>`:'<span></span>'}</div>`}).join('')}
  ${reveal?'<p class="small mute mono">taste · creativity · presentation</p>':''}</article>`}
function roundRows(r,alive){return alive.map(id=>{const chef=M.chefs.find(c=>c.id===id),dish=dishOf(id,r);return{chef,dish,round:r,sc:dish?scoreDish(dish,basketOf(r),r,M.judges):null}})}
function judge(){const r=M.round,rows=roundRows(r,M.alive);let cut=null,win=null;
 if(M.mode==='solo'){if(r<2){const s=rows.slice().sort((a,b)=>a.sc.total-b.sc.total||(a.chef.human?1:-1));cut=s[0].chef.id}
  else{const f=id=>rows.find(x=>x.chef.id===id).sc.total+.5*(M.totals[id]||[]).slice(0,2).reduce((a,b)=>a+(b||0),0);const a=rows[0].chef.id,b=rows[1].chef.id;win=f(a)>=f(b)?(f(a)===f(b)&&!rows[0].chef.human?b:a):b;cut=win===a?b:a}}
 else if(r<2){const ais=rows.filter(x=>!x.chef.human).sort((a,b)=>a.sc.total-b.sc.total);cut=ais[0].chef.id}
 rows.forEach(x=>{x.cut=x.chef.id===cut;x.win=x.chef.id===win});RES={rows,cut,win}}
function vJudging(){judge();const r=M.round,C=COURSES[r],waiting=RES.rows.some(x=>!x.sc),order=stage?RES.rows.slice().sort((a,b)=>(b.sc?b.sc.total:-1)-(a.sc?a.sc.total:-1)):RES.rows;
 return `<span class="eyebrow">Round ${r+1} · ${C.name}</span><h2>${stage?'The verdict':'At the judges’ table'}</h2>
 <div class="row">${basketOf(r).map(id=>`<span class="chip b">${ing(id).em} ${ing(id).name}</span>`).join('')}</div><div class="row">${livePill()}</div>
 <div class="col" style="gap:18px">${order.map(x=>ticket(x,stage)).join('')}</div>
 ${stage&&M.mode==='solo'&&r===2?'<p class="small mute">The final is judged on dessert plus half of each finalist’s earlier scores.</p>':''}
 <div class="foot">${!stage?`<button class="btn go wide" data-a="verdict">Hear the verdict</button>`:`<button class="btn go wide" data-a="next">${nextLabel()}</button>`}
 ${waiting?'<p class="small mute">Your rival has not plated this course yet. You can carry on. Their plate is added when it arrives.</p>':''}</div>`}
function nextLabel(){if(M.mode==='solo'&&RES.cut==='me')return 'Hang up your apron';return M.round<2?'On to the '+COURSES[M.round+1].name.toLowerCase():M.mode==='solo'?'See the result':'Final result'}
function vFinal(){const F=M.fin;if(M.mode==='solo'){const k=K();return `<span class="eyebrow">Level ${M.lvl+1} · ${k.name} · ${DIFFS[M.diff].name}</span><h1 style="font-size:clamp(44px,13vw,80px)">${F.won?'Last plate standing':'Cut in the '+COURSES[F.round].name.toLowerCase()}</h1>
  <p>${F.won?'You out-cooked the whole line. The $'+k.prize.toLocaleString()+' is yours.':'You finished '+['fourth','third','second'][F.round]+'. Read what the judges said, check your notebook, and come back.'}</p>
  <div class="panel"><h3>Your plates</h3>${M.dishes.me.map((d,r)=>`<p class="small"><b>${COURSES[r].name}:</b> ${esc(dishTitle(d,basketOf(r)))} <span class="mono warm">${M.totals.me[r]}/90</span></p>`).join('')}</div>
  ${F.unlock?`<div class="panel"><h3 class="good">Unlocked</h3><p>${F.unlock}</p></div>`:''}
  <p class="small mute">Saved to Chef ${esc(S.name)}.</p>
  ${F.won&&M.lvl<49?`<button class="btn go wide" data-a="again" data-i="${M.lvl+1}">Next level</button>`:!F.won?`<button class="btn go wide" data-a="again" data-i="${M.lvl}">Try this level again</button>`:''}
  <button class="btn wide" data-a="quit">Back to the menu</button>`}
 const opp=M.chefs.find(c=>c.id==='opp'),have=M.dishes.opp.length>=3,mine=M.totals.me||[],theirs=have?[0,1,2].map(r=>scoreOf('opp',r).total):[];
 const sm=mine.reduce((a,b)=>a+(b||0),0),st=theirs.reduce((a,b)=>a+b,0),myCode=makeResultCode(M.code,S.name,M.perk,M.dishes.me,S.look);
 return `<span class="eyebrow">Head-to-head ${esc(M.code)}</span>
  ${have?`<h1 style="font-size:clamp(44px,13vw,80px)">${sm>st?'You win':sm<st?esc(opp.name)+' wins':'Dead heat'}</h1>
   <div class="panel"><div class="row mono" style="justify-content:space-between"><b>Course</b><span>You · ${esc(opp.name)}</span></div>${[0,1,2].map(r=>`<div class="row mono small" style="justify-content:space-between"><span>${COURSES[r].name}</span><span><span class="${mine[r]>=theirs[r]?'good':''}">${mine[r]}</span> · <span class="${theirs[r]>=mine[r]?'good':''}">${theirs[r]}</span></span></div>`).join('')}
   <div class="row mono" style="justify-content:space-between"><b>Total</b><b>${sm} · ${st}</b></div></div>
   <h3>${esc(opp.name)}’s plates</h3><div class="col" style="gap:18px">${[0,1,2].map(r=>ticket({chef:opp,dish:M.dishes.opp[r],round:r,sc:scoreOf('opp',r)},1)).join('')}</div>`
  :`<h2>You scored ${sm} of 270</h2><p class="mute">${live.on?'Waiting for your rival to finish. This page updates by itself when their dessert goes out.':'To settle it, send your result code to your rival and paste theirs below.'}</p><div class="row">${livePill()}</div>`}
  <div class="panel"><h3>Your result code</h3><textarea id="mycode" readonly>${myCode}</textarea><button class="btn" data-a="copy">Copy my code</button>
  ${have?'':`<h3>Rival’s result code</h3><textarea id="oppcode" placeholder="Paste their code here"></textarea><button class="btn" data-a="paste">Compare plates</button>${joinErr?`<p class="small bad">${joinErr}</p>`:''}`}</div>
  <button class="btn ${have?'go':''} wide" data-a="quit">${have?'Back to the menu':'Leave match (it stays under Resume)'}</button>`}
/* ---- actions ---- */
function fire(forced){const st=planStats();if(!forced&&!st.ok)return;clearInterval(tick);tick=null;SV={i:0,left:st.b-dishTime(P,M.perk).a};screen='service';sheet=null;
  for(const c of P.comps)c.out=rollOut(c,Math.random,K().myRisk);render();window.scrollTo(0,0);if(P.comps.length)cookStep()}
function cookStep(){setTimeout(()=>{if(screen!=='service')return;const c=P.comps[SV.i];if(c)S.known[c.ings[0]+'|'+c.tech]=1;SV.i++;render();if(SV.i<P.comps.length)cookStep();else save()},1050)}
function finishMatch(){const F=M.fin;S.played++;if(F.won){const before=totalWins(),first=!S.cleared[M.lvl],got=[];S.cleared[M.lvl]=Math.max(S.cleared[M.lvl]||0,M.diff+1);S.cash+=K().prize;
   if(first&&M.lvl<49){S.lvl=M.lvl+1;got.push('Level '+(M.lvl+2)+' is open: '+makeCfg(M.lvl+1,M.diff).name+'.')}if(first&&M.lvl===49)got.push('You have cleared all 50 levels. Now do it on a harder setting.');
   const after=totalWins();Object.values(PERKS).forEach(p=>{if(p.wins>before&&p.wins<=after)got.push('New edge: '+p.name+'. '+p.text)});F.unlock=got.join(' ')}
  S.match=null;save()}
function pickChef(id){ST.cur=id;S=ST.chefs[id];M=null;KC=null;delId='';chefErr='';joinErr='';showBackup=false;save();go('menu')}
const ACT={
 chef:d=>{if(has(ST.chefs,d.id))pickChef(d.id)},
 ng:d=>{draft.look.g=d.v==='w'?'w':'m';chefErr='';render()},nj:d=>{draft.look.j=clamp(+d.i,0,CLOTH.length-1);render()},na:d=>{draft.look.a=clamp(+d.i,0,CLOTH.length-1);render()},
 look:()=>{sheet={t:'look'};render()},share:()=>{sheet={t:'share'};render()},
 sendlink:()=>{try{navigator.share({title:'Last Plate',text:'Cook against me in Last Plate',url:GAME_URL}).catch(()=>{})}catch(e){}},
 copylink:(d,e)=>{const b=e.target.closest('button'),done=()=>{b.textContent='Copied'},sel=()=>{const r=document.createRange();r.selectNodeContents($('#gameurl'));const g=getSelection();g.removeAllRanges();g.addRange(r)};try{navigator.clipboard.writeText(GAME_URL).then(done,sel)}catch(x){sel()}},sj:d=>{S.look.j=clamp(+d.i,0,CLOTH.length-1);save();if(M)livePush();render()},sa:d=>{S.look.a=clamp(+d.i,0,CLOTH.length-1);save();render()},sg:d=>{if(!S.look.g){S.look.g=d.v==='w'?'w':'m';save();render()}},
 addchef:()=>{const n=cleanName($('#nm').value);draft.name=n;if(!n){chefErr='Type a name first.';render();return}if(!draft.look.g){chefErr='Choose woman or man.';render();return}if(Object.values(ST.chefs).some(c=>c.name.toLowerCase()===n.toLowerCase())){chefErr='There is already a chef called '+esc(n)+'.';render();return}
  if(Object.keys(ST.chefs).length>=12){chefErr='This device already has 12 chefs. Delete one first.';render();return}
  const id=rid(8);ST.chefs[id]=blank(n);ST.chefs[id].look=cleanLook(draft.look);draft={name:'',look:{g:'',j:0,a:1}};try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}pickChef(id)},
 delchef:d=>{if(delId!==d.id){delId=d.id;render();return}delete ST.chefs[d.id];if(ST.cur===d.id){ST.cur='';S=null}delId='';save();render()},
 restore:()=>{const c=readChefCode($('#restore').value);if(!c){chefErr='That backup code is incomplete or damaged. Copy the whole thing.';render();return}
  let id=Object.keys(ST.chefs).find(k=>ST.chefs[k].name.toLowerCase()===c.name.toLowerCase());if(id){c.pid=ST.chefs[id].pid}else{if(Object.keys(ST.chefs).length>=12){chefErr='This device already has 12 chefs. Delete one first.';render();return}id=rid(8)}
  let l=0;while(l<49&&c.cleared[l])l++;c.lvl=l;ST.chefs[id]=c;pickChef(id)},
 switch:()=>{liveStop();M=null;KC=null;delId='';chefErr='';go('chefs')},backup:()=>{showBackup=true;render()},
 lvl:d=>{const l=+d.i;if(l>=0&&l<50&&lvlOpen(l)){S.lvl=l;save();render()}},diff:d=>{S.diff=clamp(+d.i,0,5);save();render()},perk:d=>{S.perk=d.id;save();render()},press:d=>{S.pressure=d.v==='1';save();render()},
 solo:()=>newMatch('solo',lvlOpen(S.lvl)?S.lvl:0,S.diff),
 again:d=>{const l=clamp(+d.i,0,49);S.lvl=lvlOpen(l)?l:0;newMatch('solo',S.lvl,M.diff)},
 host:()=>{newMatch('duel',-1,S.diff,newCode(S.diff));screen='lobby';render()},
 join:()=>{const c=($('#jc').value||'').toUpperCase().trim();if(!okCode(c)){joinErr='That code should be 5 letters and numbers.';render();return}joinErr='';newMatch('duel',-1,codeDiff(c),c)},
 resume:()=>{if(!okMatch(S.match)){S.match=null;save();render();return}KC=null;M=JSON.parse(JSON.stringify(S.match));M.fin=null;M.chefs.find(c=>c.id==='me').name=S.name;if(M.mode==='duel')liveStart();if(M.round>2){M.round=2;endDuel();return}go('basket')},
 quit:()=>{liveStop();if(M&&M.fin&&!(M.mode==='duel'&&M.dishes.opp.length<3)){S.match=null;save()}M=null;KC=null;joinErr='';go('menu')},
 to:d=>go(d.s),
 info:d=>{sheet={t:'info',id:d.id};render()},close:()=>{sheet=null;render()},scrim:(d,e)=>{if(e.target.classList.contains('scrim')){sheet=null;render()}},
 addc:()=>{const used=P.comps.map(c=>c.role),role=['main','side','sauce','garnish'].find(r=>!used.includes(r))||'side';P.comps.push({role,ings:[],tech:null,pace:1,out:2});render()},
 delc:d=>{P.comps.splice(+d.i,1);render()},role:d=>{P.comps[+d.i].role=d.v;render()},pace:d=>{P.comps[+d.i].pace=+d.v;render()},
 pick:d=>{sheet={t:'pick',i:+d.i};render()},tech:d=>{sheet={t:'tech',i:+d.i};render()},
 add:d=>{const c=P.comps[sheet.i],k=c.ings.indexOf(d.id);if(k>=0)c.ings.splice(k,1);else if(c.ings.length<3)c.ings.push(d.id);if(!c.ings.length)c.tech=null;render()},
 chip:d=>{const c=P.comps[+d.i],k=+d.k;if(k===0){c.ings.shift();if(!c.ings.length)c.tech=null}else{const[x]=c.ings.splice(k,1);c.ings.unshift(x)}render()},
 settech:d=>{if(K().ban.includes(d.id))return;P.comps[+d.i].tech=d.id;sheet=null;render()},
 fin:d=>{const k=P.fin.indexOf(d.id);if(k>=0)P.fin.splice(k,1);else if(P.fin.length<3)P.fin.push(d.id);render()},plate:d=>{P.plate=+d.v;render()},
 fire:()=>fire(false),
 refire:d=>{const c=P.comps[+d.i],cost=refireCost(c);if(cost>SV.left)return;SV.left-=cost;c.out=rollOut(c,Math.random,K().myRisk);SV.i=+d.i;const rest=P.comps.length;render();setTimeout(()=>{if(screen!=='service')return;SV.i=rest;render()},1050)},
 serve:()=>{const d={comps:P.comps.map(c=>({role:c.role,ings:c.ings.slice(),tech:c.tech,pace:c.pace,out:c.out})),fin:P.fin.slice(),plate:P.plate,left:SV.left};M.dishes.me[M.round]=d;persist();livePush();go('judging')},
 verdict:()=>{stage=1;for(const x of RES.rows)if(x.sc){(M.totals[x.chef.id]=M.totals[x.chef.id]||[])[M.round]=x.sc.total}const mine=M.totals.me[M.round];if(mine>S.best)S.best=mine;persist();render();window.scrollTo(0,0)},
 next:()=>{const r=M.round;if(M.mode==='solo'){if(RES.cut==='me'||r===2){M.fin={won:r===2&&RES.win==='me',round:r};finishMatch();go('final');return}M.alive=M.alive.filter(id=>id!==RES.cut);M.round++;persist();go('basket')}
  else{if(r<2){M.alive=M.alive.filter(id=>id!==RES.cut);M.round++;persist();go('basket')}else{M.round=3;persist();endDuel()}}},
 copy:(d,e)=>{const t=$('#mycode'),b=e.target.closest('button'),done=()=>{if(b)b.textContent='Copied'};try{navigator.clipboard.writeText(t.value).then(done,()=>{t.focus();t.select()})}catch(x){t.focus();t.select()}},
 paste:()=>{const o=readResultCode($('#oppcode').value);if(!o||o.c!==M.code){joinErr=o?'That code is from a different match.':'That code is incomplete. Copy the whole thing.';render();return}
  M.dishes.opp=[];if(!takeOpp(o)||M.dishes.opp.length<3){joinErr='That code does not hold three finished courses.';render();return}joinErr='';endDuel()}
};
function endDuel(){if(!M.fin)M.fin={duel:1};if(M.dishes.opp.length>=3&&!M.fin.counted){M.fin.counted=1;S.played++;S.match=null;save()}screen='final';sheet=null;render();window.scrollTo(0,0)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b||b.disabled)return;const f=ACT[b.dataset.a];if(f)f(b.dataset,e)});
document.addEventListener('input',e=>{if(e.target.id==='nm')draft.name=e.target.value});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet){sheet=null;render()}});
render();
}
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(function(){});
