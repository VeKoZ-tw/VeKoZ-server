import { IModelPorts, } from "../ports/out.model"
import type { ICrudOptions, IDataCountOptions } from "../ports/out.crud"
import { CollectionReference, DocumentData, DocumentSnapshot, Query, QuerySnapshot, Timestamp } from "firebase-admin/firestore"
import VenoniaCRUD from "../ports/out.crud"
/**
 * 檔案的Naming要對應firestore的存取方式
 */
export default class FirestoreAdapter extends VenoniaCRUD {
    protected collection: IModelPorts['collection'] = null as any
    protected error = {
        'collectionIsNotReady': 'Collection is not ready.',
        'docNoFound': 'Data not found by given condition',
    }

    constructor(data: IModelPorts) {
        super()
        const { collection, } = data
        if (collection) {
            this.collection = collection
        }
    }


    /**
     * C: 新增document，如果需要確保唯一，call之前先call
     * @param uid user id
     * @param data
     * @param options
     * @returns 
     */
    protected async createItem(uid: string, data: any, options?: ICrudOptions): Promise<DocumentData> {
        if (!this.collection) {
            throw this.error.collectionIsNotReady
        }
        const query = await this.getQuery([['uid', '==', uid]], options)
        if (options?.count) {
            await this.checkQueryCount(query, options.count)
        }
        const docRef = this.collection.doc()
        const lastmod = Timestamp.fromDate(new Date())
        if (!data.id) {
            data.id = docRef.id
        }
        data.lastmod = lastmod
        await this.collection.doc(data.id).set({
            ...data,
            uid // IMPORTANT 否則新資料會是null
        })
        // 轉換
        data.lastmod = new Date(data.lastmod.seconds * 1000)
        return data
    }

    /**
     * R: 利用document id取得唯一資料
     * @param id 
     * @returns 
     */
    protected async getItemById(id: string): Promise<DocumentData | number> {
        if (!this.collection) {
            throw this.error.collectionIsNotReady
        }
        const documentSnapshot: DocumentSnapshot = await this.collection.doc(id).get()
        const docData = documentSnapshot.data()
        if (docData) {
            delete docData.uid
            if (docData.lastmod) {
                docData.lastmod = new Date(docData.lastmod.seconds * 1000)
            }
            return docData
        }
        return 0
    }

    /**
     * R: 利用document id取得唯一資料欄位
     * @param id 
     * @param field 
     * @returns 
     */
    protected async getFieldById(id: string, field: string): Promise<unknown> {
        if (!this.collection) {
            throw this.error.collectionIsNotReady
        }
        const docData: DocumentData = await this.collection.doc(id).get()
        const result = docData.get(field)
        return result
    }

    /**
     * R: 利用條件查詢資料
     * @param uid 
     * @param options 
     */
    protected async getItemsByQuery(wheres: any[][], options?: ICrudOptions): Promise<DocumentData[]> {
        if (!this.collection) {
            throw this.error.collectionIsNotReady
        }
        // 檢查資料數量
        const query = await this.getQuery(wheres, options)
        if (options?.count) {
            await this.checkQueryCount(query, options.count)
        }
        // 取得資料
        let docs = (await query.get()).docs
        if (options?.slice) {
            const slice = options.slice
            if (slice instanceof Array) {
                docs = docs.slice(...slice)
            } else {
                docs = docs.slice(slice)
            }
        }
        const docDatas = docs.map(doc => {
            const docData = doc.data()
            delete docData.uid // IMPORTANT
            if (docData.lastmod) {
                docData.lastmod = new Date(docData.lastmod.seconds * 1000)
            }
            return docData
        })
        return docDatas
    }

    /**
     * U: 更新現有的Documents
     * @param uid user id
     * @param data 
     */
    protected async setItemsByQuery(wheres: any[][], data: any, options: ICrudOptions = {}): Promise<number> {
        const query: Query = await this.getQuery(wheres)
        const count = await this.checkQueryCount(query, options.count ?? {})
        const lastmod = Timestamp.fromDate(new Date())
        data.lastmod = lastmod
        const docs = (await query.get()).docs
        const promiese = docs.map(doc => {
            return doc.ref.update(data, {
                merge: options?.merge
            })
        })
        await Promise.all(promiese)
        return count
    }

    /**
     * U: 更新現有的某個Document
     * @param uid 
     * @param id 
     * @param options 
     * @returns 
     */
    protected async setItemById(uid: string, id: string, data: any, options?: ICrudOptions) {
        if (!this.collection) {
            throw this.error.collectionIsNotReady
        }
        const targetQuery = this.collection.where('uid', '==', uid)
        const countData = await targetQuery.count().get()
        const count: number = countData.data().count
        if (count == 0) {
            return 0
        }
        const docDatas: DocumentData = await targetQuery.get()
        const targetDoc: DocumentData = docDatas.docs.find((doc: DocumentData) => {
            return doc.id === id
        })
        if (targetDoc) {
            const lastmod = Timestamp.fromDate(new Date())
            data.lastmod = lastmod
            await targetDoc.ref.update(data, {
                merge: options?.merge
            })
            return 1
        } else {
            return 0
        }
    }

    /**
     * Delete 刪除符合條件的資料
     * @param uid 使用者uid
     * @returns 
     */
    protected async deleteItemsByQuery(wheres: any[][], options?: ICrudOptions): Promise<number> {
        if (!this.collection) {
            throw this.error.collectionIsNotReady
        }
        const query = await this.getQuery(wheres, options)
        const count = await this.checkQueryCount(query, options?.count ?? {})
        const docs = (await query.get()).docs
        const promises = docs.map(doc => {
            return doc.ref.delete()
        })
        await Promise.all(promises)
        return count
    }
    /**
     * 刪除其中一個由使用者建立的文件
     * @param uid 使用者uid
     * @param id 文件id
     * @returns 
     */
    protected async deleteItemById(uid: string, id: string, options?: ICrudOptions): Promise<number> {
        if (!this.collection) {
            throw this.error.collectionIsNotReady
        }
        const targetQuery = this.collection.where('uid', '==', uid).where('id', '==', id)
        const count = await this.checkQueryCount(targetQuery, options?.count ?? {})
        const querySnapShot: QuerySnapshot = await targetQuery.get()
        const promiese = querySnapShot.docs.map(doc => {
            return this.collection?.doc(doc.id).delete()
        })
        await Promise.all(promiese)
        return count
    }

    /**
     * 從ISO轉為Timestamp
     * @param isoDateString 
     * @returns 
     */
    protected formatTimestamp(isoDateString: string) {
        if (!isoDateString) {
            return
        }
        return Timestamp.fromDate(new Date(isoDateString))
    }

    /**
     * 從Timestamp轉為Date
     * @param timestamp 
     * @returns 
     */
    protected formatDate(timestamp: Timestamp) {
        if (!timestamp) {
            return
        }
        return new Date(timestamp.seconds * 1000).toISOString()
    }

    /**
     * Utility: 取得組合出來的Query，controller不應該知道where語法
     * @param wheres 
     * @returns 
     */
    protected async getQuery(wheres: any[][], options?: ICrudOptions): Promise<Query> {
        if (!this.collection) {
            throw this.error.collectionIsNotReady
        }
        let query: CollectionReference | Query = this.collection
        wheres.forEach((where: any[]) => {
            const field = where[0]
            const operator = where[1]
            const value = where[2]
            query = query.where(field, operator, value)
        })
        if (options?.orderBy) {
            const fieldPath = options.orderBy[0]
            const orderByDirection = options.orderBy[1] as 'desc' | 'asc'
            query = query.orderBy(fieldPath, orderByDirection)
        }
        return query
    }

    /**
     * Utility: 確保Document中的數量有限
     * @param uid user id
     * @returns 
     */
    protected async checkQueryCount(query: Query, options: IDataCountOptions = {}): Promise<number> {
        if (!this.collection) {
            throw this.error.collectionIsNotReady
        }
        const countData = await query.count().get()
        const count: number = countData.data().count
        let message = ''
        if (options.max && count >= options.max) {
            message = `資料數量已達上限: ${count} > ${options.max}`
        }
        if (options.min && count < options.min) {
            message = `資料數量低於下限: ${count} < ${options.min}`
        }
        if (options.absolute && count !== options.absolute) {
            message = `資料數量數值不合: ${count} !== ${options.absolute}`
        }
        if (options.range && !options.range.includes(count)) {
            message = `資料數量範圍不合: ${count} 不在 ${options.range} 中`
        }
        if (message) {
            console.trace(message)
            throw message
        }
        return count
    }
}