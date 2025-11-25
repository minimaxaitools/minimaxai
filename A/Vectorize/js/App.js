(function () {
  const background_pattern = createBackgroundPattern();
  const App = function (options) {
    const templates = {
      elem: grabTemplate("#template-file")
    },
      filesParent = document.querySelector("#filesSlot"),
      filesScroll = document.querySelector("#filesScroll"),
      idList = [];
    const self = new Bind({
      elem: document.querySelector("#app"),
      data: {
        list: [],
        sessionId: createId(),
        isUploading: false,
        isProcessing: false,
        convertParams: options.convertParams || {},
        prevDisabled: true,
        nextDisabled: true
      },
      computed: {
        counter: function () {
          return this.list.filter(function (item) { return item.processed; }).length;
        },
        downloadDisabled: function () {
          return !this.counter || this.list.some(function (item) { return item.processing });
        }
      },
      methods: {
        add: function (file) {
          const check = this.check(file);
          if (check !== true) {
            if (typeof check == "string" && appText[check]) {
              notify(appText[check], check == "type" && appSettings.formats.join(", "));
            } else {
              notify(appText.error, file.name);
            }
            return;
          }
          if (this.list.length <= options.maxLength) {
            this.list.push(createElement(file));
            scrollFiles(Infinity);
          }
        },
        check: function (file) {
          let ext = file.name.split(".").pop().toLowerCase(),
            formats = (options.formats || []).map(function (format) {
              return format.toLowerCase();
            });
          if (formats.indexOf(ext) == -1) {
            return "type";
          }
          if (options.maxSize < file.size) {
            return "size";
          }
          return true;
        },
        remove: function (item) {
          let i;
          this.abort(item);
          for (i in this.list) {
            if (this.list[i] == item) {
              break;
            }
          }
          this.list.splice(i, 1);
          this.onScroll();
        },
        clear: function () {
          for (let i = 0, l = this.list.length; i < l; i++) {
            this.remove(this.list[0]);
          }
          this.isUploading = false;
          this.isProcessing = false;
        },
        download: function () {
          let name = options.allName,
            order = this.list.filter(function (item) {
              return item.processed
            }).map(function (item) {
              return item.id
            }),
            href = options.origin + "all/" + self.sessionId + "/" + name + "?order=" + order.join(",") + "&rnd=" + Math.random();
          download(href, name);
        },
        scrollNext: function () { scrollFiles("next"); },
        scrollPrev: function () { scrollFiles("prev"); },
        onScroll: function () {
          if (filesScroll.scrollLeft <= 0) {
            this.prevDisabled = true;
          } else {
            this.prevDisabled = false;
          }
          if (filesScroll.scrollLeft >= filesScroll.scrollWidth - filesScroll.offsetWidth) {
            this.nextDisabled = true;
          } else {
            this.nextDisabled = false;
          }
        },
        setOrder: function (order) {
          let attrs = [0, this.list.length];
          for (let i = 0, l = order.length; i < l; i++) {
            let index = order[i];
            attrs.push(this.list[index]);
          }
          Array.prototype.splice.apply(this.list, attrs);
        },
        upload: uploadFile,
        process: processFile,
        abort: abortFile
      },
      watch: {
        list: function () {
          const children = Array.prototype.slice.call(filesParent.children);
          // console.log(self.list.slice().map(function (a) { return a.elem }));
          for (let index in self.list) {
            let item = self.list[index],
              i = children.indexOf(item.elem);
            if (i != -1) {
              children.splice(i, 1);
            }
            filesParent.appendChild(item.elem);
          }
          for (let index in children) {
            let elem = children[index];
            elem.parentNode.removeChild(elem);
          }
        }
      }
    });
    return self;
    function scrollFiles(value) {
      let scrollOffset = filesParent.parentNode;
      if (value == "prev" || value == "next") {
        value = getPosition(value, scrollOffset);
      }
      new SmoothScroll(scrollOffset).scrollTo(value, 500);
    }
    function getPosition(key, scrollOffset) {
      let width = scrollOffset.offsetWidth,
        left = scrollOffset.scrollLeft,
        padding = filesParent.offsetLeft;
      if (key == "prev") {
        let elem = getElemAfter(left - width + padding);
        return elem.offsetLeft || 0;
      } else {
        let elem = getElemAfter(left + width - padding * 2);
        elem = elem ? elem : { offsetLeft: Infinity };
        return Math.min(elem.offsetLeft, scrollOffset.scrollWidth - width);
      }
      function getElemAfter(pos) {
        let children = Array.prototype.slice.call(filesParent.children);
        for (let index in children) {
          let elem = children[index];
          if (elem.offsetLeft >= pos) {
            return elem;
          }
        }
        return null;
      }
    }
    function processQueue() {
      self._compute("counter");
      self._compute("downloadDisabled");
      if (self.isUploading && self.isProcessing) {
        return;
      }
      for (let index in self.list) {
        let item = self.list[index];
        if (item.error || item.processed) {
          continue;
        }
        if (!self.isUploading && !item.uploaded) {
          self.isUploading = true;
          self.upload(item).onLoad(function (response) {
            item.percent = 0;
          }).onFinal(function () {
            self.isUploading = false;
            processQueue();
          });
          continue;
        }
        if (!self.isProcessing && !item.processed && item.uploaded) {
          self.isProcessing = true;
          self.process(item).onFinal(function () {
            self.isProcessing = false;
            processQueue();
          });
        }
      }
      self._compute("downloadDisabled");
    }
    function createElement(file) {
      return new Bind({
        template: templates.elem,
        data: {
          file: file,
          name: file.name,
          id: createId(26, "file_"),
          thumbnail_src: "",
          percent: 0,
          size: file.size,
          savings: "",
          processing: false,
          processed: false,
          uploaded: false,
          status: "init",
          error: null,
          human_size: getHumanSize(file.size),
          fitted_name: file.name
        },
        computed: {
          elem_process: function () {
            return this.processing || this.status == "waiting" || this.status == "init";
          }
        },
        methods: {
          remove: function () {
            self.remove(this);
          },
          onUploaded: function (response) {
            this.status = "waiting";
          },
          onProcessed: function (response) {
            createThumb(
              options.origin + response.thumb_url,
              this.elem.offsetWidth,
              (function (src) {
                this.thumbnail_src = src;
                this.status = "processed";
              }).bind(this)
            );
            this.response = response;
            this.savings = this.response.savings || "";
          },
          download: function () {
            if (!this.response) {
              return;
            }
            let name = this.response.convert_result,
              href = options.origin + "download/" + self.sessionId + "/" + this.id + "/" + name;
            download(href, name);
          },
          repeat: function () {
            if (!this.uploaded) {
              this.status = "init";
              if (!self.isUploading) {
                processQueue();
              }
            } else if (!this.processed) {
              this.status = "uploaded";
              if (!self.isProcessing) {
                processQueue();
              }
            }
          }
        },
        mounted: function () {
          const title = this.elem.querySelector(".file__title");
          if (!title || title.offsetWidth == 0) {
            return this.name;
          }
          this.fitted_name = fitText(this.name, title);
          processQueue();

          if (window.onFirstFileAdded) window.onFirstFileAdded();
        },
        watch: {
          processing: function (value) {
            if (!value) {
              return;
            }
            if (!this.uploaded) {
              this.status = "uploading";
            } else if (!this.processed) {
              this.status = "processing";
            }
          },
          error: function (value) {
            if (!value) {
              return;
            }
            this.status = "error";
          },
          status: function (value) {
            if (value != "error") {
              this.error = null;
            }
          }
        }
      })
    }
    function createThumb(url, size, callback) {
      const canvas = document.createElement("canvas"),
        context = canvas.getContext("2d");
      let img = new Image(),
        pixelRatio = window.devicePixelRatio;
      img.addEventListener("load", createCover);
      img.addEventListener("error", onError);
      size *= pixelRatio;
      canvas.width = size;
      canvas.height = size;
      context.scale(pixelRatio, pixelRatio);
      context.fillStyle = background_pattern;
      context.fillRect(0, 0, size, size);
      context.scale(1 / pixelRatio, 1 / pixelRatio);
      if (!url) {
        onError();
        return;
      }
      img.src = url;
      function onError() {
        callback(canvas.toDataURL());
      }
      function createCover() {
        const ih = img.naturalHeight,
          iw = img.naturalWidth,
          mwc = (iw - ih) / 2,
          mhc = (ih - iw) / 2;
        let sx, sy, sw, sh;
        if (Math.max(ih, iw) / Math.min(ih, iw) > 2.5) {
          // contain
          sx = ih > iw ? mwc : 0;
          sy = ih > iw ? 0 : mhc;
          sh = ih > iw ? ih : iw;
          sw = sh;
        } else {
          // cover
          sx = ih > iw ? 0 : mwc;
          sy = ih > iw ? mhc : 0;
          sw = ih > iw ? iw : ih;
          sh = sw;
        }
        context.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
        callback(canvas.toDataURL());
      }
    }
    function uploadFile(file) {
      let href = options.origin + "upload/" + this.sessionId;
      file.processing = true;
      file.percent = 0;
      file.ajax = new Ajax("POST", href, {
        type: "formData",
        data: {
          file: file.file,
          id: file.id,
          name: file.name
        }
      }).onProgress(function (progress) {
        file.percent = Math.ceil(progress * 100);
      }).onLoad(function (response) {
        file.percent = 100;
        file.uploaded = true;
        file.onUploaded(response);
      }).onError(function (err) {
        file.error = err;
        file.uploaded = false;
        err != "abort" && notify(appText.error, file.name);
      }).onFinal(function () {
        file.processing = false;
      });
      return file.ajax;
    }
    function processFile(file) {
      let href = options.origin + "convert/" + this.sessionId + "/" + file.id;
      file.processing = true;
      file.percent = 0;
      file.ajax = new Ajax("GET", href, {
        progress: {
          key: "progress",
          url: href.replace("/convert/", "/status/")
        },
        data: this.convertParams
      }).onProgress(function (progress) {
        file.percent = progress;
      }).onLoad(function (response) {
        file.percent = 100;
        file.processed = true;
        file.onProcessed(response);
      }).onError(function (err) {
        file.error = err;
        err != "abort" && notify(appText.error, file.name);
      }).onFinal(function () {
        file.processing = false;
      });
      return file.ajax;
    }
    function abortFile(file) {
      file.ajax.abort();
      return file.ajax;
    }
    function notify(text, bold) {
      if (bold) {
        text += " <b>" + bold + "</b>";
      }
      new Notice(text);
    }
    function grabTemplate(selector) {
      const elem = document.querySelector(selector),
        inner = elem.innerText;
      elem.parentNode.removeChild(elem);
      return inner;
    }
    function getHumanSize(size) {
      let i = Math.floor(Math.log(size) / Math.log(1024));
      return (size / Math.pow(1024, i)).toFixed(i == 2 ? 1 : 0) * 1 + " " + ["B", "KB", "MB"][i];
    }
    function createId(length, prefix) {
      length = length || 16;
      prefix = prefix || "";
      let result = "";
      while (result.length < length) {
        result += Math.floor(65535 * Math.random()).toString(32);
      }
      result = prefix + result.slice(0, length);
      if (idList.indexOf(result) != -1) {
        return createId(length, prefix);
      } else {
        idList.push(result);
        return result;
      }
    }
    function fitText(text, elem) {
      const TAIL_LENGTH = 7,
        canvas = document.createElement("canvas"),
        context = canvas.getContext("2d", { alpha: false }),
        textStyle = window.getComputedStyle(elem),
        elemWidth = elem.offsetWidth;
      let textWidth,
        tailWidth,
        startWidth = 0,
        index = 0;

      context.font = textStyle.getPropertyValue("font-weight") +
        " " + textStyle.getPropertyValue("font-size") +
        " " + textStyle.getPropertyValue("font-family");
      textWidth = context.measureText(text).width;
      if (textWidth <= elemWidth) {
        return text;
      }
      text = [text.slice(0, -TAIL_LENGTH), text.slice(-TAIL_LENGTH)];
      tailWidth = context.measureText(text[1]).width;
      while (startWidth + tailWidth < elemWidth) {
        index += 1;
        startWidth = context.measureText(text[0].slice(0, index) + "…").width;
      }
      return text[0].slice(0, index - 1) + "…" + text[1];
    }
    function download(href, name) {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.download = name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      requestAnimationFrame(function () {
        document.body.removeChild(a);
      });

      if (!download.eventFired) {
        setTimeout(function() {
          window.dispatchEvent(new CustomEvent('firstDownload'));
          download.eventFired = true;
        }, 1000);
      }
    }
  }
  function createBackgroundPattern() {
    const SIZE = 5,
      canvas = document.createElement("canvas"),
      context = canvas.getContext("2d", { alpha: false });
    canvas.width = SIZE * 2;
    canvas.height = SIZE * 2;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, SIZE, SIZE);
    context.fillRect(SIZE, SIZE, SIZE, SIZE);
    context.fillStyle = "#eee";
    context.fillRect(SIZE, 0, SIZE, SIZE);
    context.fillRect(0, SIZE, SIZE, SIZE);
    return context.createPattern(canvas, "repeat");
  }
  window.App = App;
})();