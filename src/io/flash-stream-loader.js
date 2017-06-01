import Log from '../utils/logger.js';
import { BaseLoader, LoaderStatus, LoaderErrors } from './loader.js';
import { RuntimeException } from '../utils/exception.js';

// For FLV over Flash live stream
class FlashStreamLoader extends BaseLoader {

    constructor(seekHandler, config) {
        super('flash-stream-loader');
        this.TAG = 'FlashStreamLoader';

        this._needStash = true;
        this._receivedLength = 0;

        if (config && config.flashStreamLoaderLib)
            this._flashlib = config.flashStreamLoaderLib;
        else
            throw new RuntimeException('flash-stream-loader need a flash lib. use config.flashStreamLoaderLib to set.');
    }

    destroy() {
        if (this._flashlib) {
            this.abort();
        }
        super.destroy();
    }

    open(dataSource) {
        try {
            this._flashlib.onVideoOpen = this._onVideoOpen.bind(this);
            this._flashlib.onVideoError = this._onVideoError.bind(this);
            this._flashlib.onVideoComplete = this._onVideoComplete.bind(this);
            this._flashlib.onVideoData = this._onVideoData.bind(this);
            this._flashlib.loadVideo(dataSource.url);
            this._status = LoaderStatus.kConnecting;
        } catch (e) {
            this._status = LoaderStatus.kError;
            let info = { code: e.code, msg: e.message };
            if (this._onError) {
                this._onError(LoaderErrors.EXCEPTION, info);
            } else {
                throw new RuntimeException(info.msg);
            }
        }
    }

    abort() {
        if (this._flashlib)
            this._flashlib.closeVideo();
        this._flashlib = null;
        this._status = LoaderStatus.kComplete;
        this._receivedLength = 0;
    }

    _onVideoOpen() {
        this._status = LoaderStatus.kBuffering;
    }

    _onVideoComplete() {
        this._status = LoaderStatus.kComplete;
        if (this._onComplete) {
            this._onComplete(0, this._receivedLength - 1);
        }
    }

    _onVideoData(base64) {
        this._dispatchArrayBuffer(
            Uint8Array.from(
                atob(base64), char => char.charCodeAt(0)
            ).buffer
        );
    }

    _dispatchArrayBuffer(arraybuffer) {
        let chunk = arraybuffer;
        let byteStart = this._receivedLength;
        this._receivedLength += chunk.byteLength;

        if (this._onDataArrival) {
            this._onDataArrival(chunk, byteStart, this._receivedLength);
        }
    }

    _onVideoError() {
        this._status = LoaderStatus.kError;

        let info = {
            code: -1,
            msg: 'flash-stream-loader load error'
        };

        if (this._onError) {
            this._onError(LoaderErrors.EXCEPTION, info);
        } else {
            throw new RuntimeException(info.msg);
        }
    }

}

export default FlashStreamLoader;