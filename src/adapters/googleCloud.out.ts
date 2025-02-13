/**
 * Google Cloud Run自動加載container上綁定的service account去執行
 * https://cloud.google.com/run/docs/configuring/services/service-identity
 */
/**
 * 如果是本地就要運行gcloud auth application-default login來指派ADC
 * https://cloud.google.com/docs/authentication/provide-credentials-adc
 */
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

export class GoogleCloudPlugin {
    protected sercertManagerServiceClient: SecretManagerServiceClient
    private secrets: { [key: string]: any } = {}
    constructor() {
        // Secret
        const client = new SecretManagerServiceClient()
        this.sercertManagerServiceClient = client
    }
    public async accessSecret(name: string = '') {
        const [version] = await this.sercertManagerServiceClient.accessSecretVersion({
            name: `projects/83032571165/secrets/${name}/versions/latest`,
        })
        if (version.payload?.data) {
            const payload = version.payload.data.toString();
            let parsedValue = null
            try {
                parsedValue = JSON.parse(payload)
            } catch (error) {
                parsedValue = payload
            } finally {
                this.secrets[name] = parsedValue
                return parsedValue
            }
        } else {
            throw `accessSecretVersion failed. ${name}`
        }
    }
    async getCalendarEventList(calendarId: string): Promise<any[]> {
        const apiKey = this.secrets['GOOGLE_CALENDAR_API_KEY']
        return []
    }
}
const googleCloud = new GoogleCloudPlugin()
export default googleCloud
