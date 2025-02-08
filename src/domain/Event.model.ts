import Firestore from '../adapters/Firestore.out'
import type { IFirestoreAdapters } from '../entities/dataAccess'
import { IEventTemplate } from '../entities/eventTemplate'

export default class EventModel extends Firestore {
    constructor(data: IFirestoreAdapters) {
        super(data)
    }

    /**
     * 新增
     * @param uid 
     * @param eventTemplate 
     * @returns 
     */
    async createEvent(uid: string, eventTemplate: IEventTemplate): Promise<IEventTemplate> {
        const newEventDoc: IEventTemplate = await this.createItem(uid, eventTemplate)
        return newEventDoc
    }

    /**
     * 查詢
     * @param id 
     * @returns 
     */
    async getEventById(id: string): Promise<IEventTemplate | 0> {
        const events = await this.getItemsByQuery([['id', '==', id]]) as IEventTemplate[]
        if (events) {
            return events[0]
        }
        return 0
    }

    /**
     * 修改
     * @param uid 
     * @param eventTemplate 
     * @returns 
     */
    async mergeDesignIds(uid: string, id: string, designIds: string[]): Promise<number> {
        const data = {
            designIds,
        }
        const dataAccessOptions = {
            count: {
                min: 0,
            },
            merge: true,
        }
        const count = await this.setItemsByQuery([['uid', '==', uid], ['id', '==', id]], data, dataAccessOptions)
        return count
    }

    /**
     * 刪除
     * @param uid 
     * @param id 
     * @returns 
     */
    async deleteByEventId(uid: string, id: string): Promise<number> {
        const count = await this.deleteItemsByQuery([['uid', '==', uid], ['id', '==', id]])
        return count
    }
}