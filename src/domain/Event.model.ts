import FirestoreAdapter from '../adapters/Firestore.adapter'
import type { IModelPorts } from '../ports/out.model'
import type { IEvent, IEventQuery } from '../entities/event'
import { ICrudOptions } from '../ports/out.crud'

export default class EventModel extends FirestoreAdapter {
    constructor(data: IModelPorts) {
        super(data)
    }

    /**
     * 新增
     * @param uid 
     * @param event 
     * @returns 
     */
    async createEvent(uid: string, event: IEvent): Promise<IEvent> {
        event.startDate = super.formatTimestamp(event.startDate)
        event.endDate = super.formatTimestamp(event.endDate)
        const newEventDoc: IEvent = await super.createItem(uid, event) as IEvent
        event.startDate = super.formatDate(event.startDate)
        event.endDate = super.formatDate(event.endDate)
        return newEventDoc
    }

    /**
     * R
     * @param condition 
     * @returns 
     */
    async queryEventList(query: IEventQuery): Promise<IEvent[]> {
        const wheres = []
        if (query.organizerId) {
            wheres.push(['organizerId', '==', query.organizerId])
        }
        if (query.startDate) {
            const startDate = new Date(query.startDate)
            if (!isNaN(startDate.getTime())) {
                wheres.push(['startDate', '>=', startDate])
            }
        }
        if (query.endDate) {
            const endDate = new Date(query.endDate)
            if (!isNaN(endDate.getTime())) {
                wheres.push(['endDate', '<=', endDate])
            }
        }
        if (query.startHour) {
            wheres.push(['startHour', '==', query.startHour])
        }
        if (query.keywords?.length) {
            wheres.push(['keywords', 'array-contains-any', query.keywords])
        }
        if (String(query.isPublic) === 'true') {
            wheres.push(['isPublic', '==', true])
        }
        if (String(query.isPublic) === 'false') {
            wheres.push(['isPublic', '==', false])
        }

        const options: ICrudOptions = {
            orderBy: ['startDate', 'asc'],
        }
        // 必須放在最後的區域選擇
        let hasOnSite = query.locationAddressRegion
        if (query.locationAddressRegion) {
            wheres.push(['locationAddressRegion', '==', query.locationAddressRegion])
        }
        // console.log({
        //     wheres
        // })
        const firstEventList = await super.getItemsByQuery(wheres, options)
        firstEventList.forEach(docData => {
            if (docData.startDate) {
                docData.startDate = super.formatDate(docData.startDate)
            }
            if (docData.endDate) {
                docData.endDate = super.formatDate(docData.endDate)
            }
        })

        /**
         * 在選定城市情況下，補外縣市的線上活動
         */
        let onlineEvents: IEvent[] = []
        if (String(query.hasVirtualLocation) === 'true') {
            if (hasOnSite) {
                wheres.pop() // 丟掉城市篩選
                wheres.push(['locationAddressRegion', '!=', query.locationAddressRegion])
            }
            wheres.push(['hasVirtualLocation', '==', true])
            onlineEvents = await super.getItemsByQuery(wheres, options)
            onlineEvents.forEach(docData => {
                if (docData.startDate) {
                    docData.startDate = super.formatDate(docData.startDate)
                }
                if (docData.endDate) {
                    docData.endDate = super.formatDate(docData.endDate)
                }
            })
        }

        const allEvents = [...firstEventList, ...onlineEvents].sort((first, second) => {
            return second.startDate - first.startDate
        })

        // 節省流量
        const requiredFiels = [
            'id', 'banner', 'name', 'startDate', 'endDate', 'organizerName',
            'organizerLogo', 'offerCategoryIds', 'dateDesignId',
            'locationAddressRegion', 'hasVirtualLocation', 'isPublic']
        const minimumEvents = allEvents.map((event: IEvent) => {
            const miniEvent: IEvent = {}
            requiredFiels.forEach(field => {
                miniEvent[field] = event[field]
            })
            return miniEvent
        })
        return minimumEvents as IEvent[]
    }

    /**
     * 查詢
     * @param id 
     * @returns 
     */
    async getEventById(id: string): Promise<IEvent | 0> {
        const events = await super.getItemsByQuery([['id', '==', id]]) as IEvent[]
        if (events) {
            const event = events[0]
            if (event.startDate) {
                event.startDate = super.formatDate(event.startDate)
            }
            if (event.endDate) {
                event.endDate = super.formatDate(event.endDate)
            }
            return event
        }
        return 0
    }

    /**
     * 修改
     * @param uid 
     * @param id 
     * @param data 
     * @returns 
     */
    async mergeEventById(uid: string, id: string, event: IEvent): Promise<number> {
        if (event.startDate) {
            event.startDate = super.formatTimestamp(event.startDate)
        }
        if (event.endDate) {
            event.endDate = super.formatTimestamp(event.endDate)
        }
        const dataAccessOptions = {
            count: {
                absolute: 1
            },
            merge: true,
        }
        const count = await super.setItemsByQuery([['uid', '==', uid], ['id', '==', id]], event, dataAccessOptions)
        return count
    }

    /**
     * 刪除
     * @param uid 
     * @param id 
     * @returns 
     */
    async deleteByEventId(uid: string, id: string): Promise<number> {
        const count = await super.deleteItemById(uid, id)
        return count
    }
}