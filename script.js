class handleScreenCaptureSteamWithIndexedDB {
    constructor(database, version = 1) {
        this.dbName = database
        this.dbVersion = version
        this.chunkTable = null
        this.handlerTable = null
        this.allBlobs = []
        this.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        this.idbKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;


        const request = this.indexedDB.open(this.dbName, this.dbVersion)

        //create a objectStore
        request.onupgradeneeded = e => {
            const result = e.target.result
            result.createObjectStore('handler', {keyPath: 'id'})
            result.createObjectStore('chunks', {keyPath: 'id'})

        }

        this.getAllBlobs()


    }

    saveDataToIndexedDB(key, chunk, first, number) {
        if (chunk && chunk?.size) {
            const request = this.indexedDB.open(this.dbName, this.dbVersion)

            if (first) {
                request.onsuccess = e => {
                    let result = e.target.result
                    this.chunkTable = result.transaction('chunks', 'readwrite').objectStore('chunks')
                    this.handlerTable = result.transaction('handler', 'readwrite').objectStore('handler')
                    this.chunkTable.add({id: key + '_' + number, chunk: chunk})
                    this.handlerTable.add({id: key, count: number})
                    this.getAllBlobs()
                }
                request.onerror = e => {
                    alert("Database error!")
                }

            } else {
                // store chunk to existed objectStore
                request.onsuccess = e => {
                    let result = e.target.result
                    this.chunkTable = result.transaction('chunks', 'readwrite').objectStore('chunks')
                    this.handlerTable = result.transaction('handler', 'readwrite').objectStore('handler')
                    this.chunkTable.add({id: key + '_' + number, chunk: chunk})
                    this.handlerTable.put({id: key, count: number})
                    this.getAllBlobs()
                }

                request.onerror = e => {
                    alert("Database error!")
                }
            }

        }


    }


    async startScreenCapture() {

        if (window?.MediaRecorder) {
            let number = 0;
            this.stream = await navigator.mediaDevices.getDisplayMedia({video: {cursor: 'always'}, audio: true})
            let first = true

            if (this.stream?.active) {

                window.recorder = new MediaRecorder(this.stream)
                window.recorder.ondataavailable = ({data}) => {
                    number++;
                    this.saveDataToIndexedDB(this.stream.id, data, first, number)
                    first = false
                }
                window.recorder.start(500)
            }


        } else {
            alert('No media recorder found!')
        }

    }

    /**
     * cb: (handlers) => { console.log(handlers)}
     * *
     * */
    getAllHandlers(cb) {
        const request = this.indexedDB.open(this.dbName, this.dbVersion)

        request.onsuccess = ({target: {result: db}}) => {
            this.handlerTable = db.transaction('handler', 'readwrite').objectStore('handler')
            const request = this.handlerTable.getAll()
            request.onsuccess = (res) => {
                cb(res.target.result)
            }
        }
    }


    /**
     * params
     *  handler: {id: 'xysdlde5f63f6f', count: 45}
     *  cb: (blob) => { console.log(blob) }
     */
    getByHandler(handler, cb) {
        const idbBound = this.idbKeyRange.bound(handler.id + '_1', handler.id + '_' + handler.count)
        const request = this.indexedDB.open(this.dbName, this.dbVersion)

        let blob = new Blob()

        request.onsuccess = ({target: {result: db}}) => {
            this.chunkTable = db.transaction('chunks', 'readwrite').objectStore('chunks')
            const request = this.chunkTable.openCursor(idbBound)
            request.onsuccess = ({target: {result: cursor}}) => {
                if (cursor) {
                    blob = new Blob([blob, cursor.value.chunk], {type: cursor.value.chunk.type})
                    cursor.continue()
                } else {
                    cb(blob)
                }
            }
        }

    }


    /**
     * this will store all buffer in this.allBlobs
     * it take some time wait few time and check this.allBlobs after call this method
     */
    getAllBlobs() {
        this.allBlobs = []
        let tx;
        const dbRequest = this.indexedDB.open(this.dbName, this.dbVersion)
        dbRequest.onsuccess = ({target: {result: db}}) => {
            tx = db.transaction(db.objectStoreNames, 'readonly')
            // get all handler first
            const handlerRequest = tx.objectStore("handler").getAll()
            handlerRequest.onsuccess = ({target: {result: handlers}}) => {
                // now get all blobs from handler by make cursor
                handlers?.forEach(handler => {
                    this.getByHandler(handler,(blob) => {
                        this.allBlobs.push({blob, handler})

                    })
                })

            }

        }

    }

    deleteChunksById(handler, cb){
        const idbBound = this.idbKeyRange.bound(handler.id + '_1', handler.id + '_' + handler.count)
        const request = this.indexedDB.open(this.dbName, this.dbVersion)

        let tx;

        request.onsuccess = ({target: {result: db}}) => {
            tx = db.transaction(db.objectStoreNames, 'readwrite')
            const deleteRequestHandler = tx.objectStore('handler').delete(handler.id)
            deleteRequestHandler.onsuccess = () => {
                const deleteRequestChunks = tx.objectStore('chunks').delete(idbBound)
                deleteRequestChunks.onsuccess = () => {
                    cb('Delete Successful!')
                    this.getAllBlobs()
                }
            }
        }
    }

    /**
     *
     * @param cb: callback
     *  (message) => console.log(message)
     */

    clearDB(cb) {
        const request = this.indexedDB.open(this.dbName, this.dbVersion)
        let tx;

        request.onsuccess = ({target: {result: db}}) => {
            tx = db.transaction(db.objectStoreNames, 'readwrite')
            const deleteRequestHandler = tx.objectStore('handler').clear()
            deleteRequestHandler.onsuccess = () => {
                const deleteRequestChunks = tx.objectStore('chunks').clear()
                deleteRequestChunks.onsuccess = () => {
                    cb('Delete Successful!')
                    this.getAllBlobs()
                }
            }
        }
    }


}


