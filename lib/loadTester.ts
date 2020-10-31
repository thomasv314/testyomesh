import { IConfig } from 'lib/config'
import Logger from './logger'
import got from 'got'

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
interface ITask {
  method: HttpMethod
  url: string
}

export interface ILoadTester {
  start(): Promise<void>
  stop(): Promise<void>
}

export class LoadTester implements ILoadTester {
  private readonly config: IConfig
  private readonly logger = new Logger('load-tester')
  private static readonly HTTP_METHODS: HttpMethod[] = [
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'PATCH',
    'DELETE'
  ]
  private static readonly HTTP_ENDPOINTS: string[] = ['/instant', '/delayed']
  private readonly tasks: ITask[] = []
  private running = true

  constructor(config: IConfig) {
    this.config = config
    this.config.simpleServiceNames.forEach((service) => {
      const otherServices = this.config.simpleServiceNames.filter(
        (other) => other !== service
      )

      LoadTester.HTTP_METHODS.forEach((method) => {
        const endpoints = LoadTester.HTTP_ENDPOINTS
        endpoints.forEach((endpoint) => {
          this.tasks.push({
            method,
            url: `http://${service}.testyomesh.svc.cluster.local${endpoint}`
          })
          otherServices.forEach((otherService) => {
            this.tasks.push({
              method,
              url: `http://${service}.testyomesh.svc.cluster.local/downstream?servers=${otherService}.testyomesh.svc.cluster.local${endpoint}`
            })
          })
        })
      })
    })
  }

  public async start(): Promise<void> {
    this.logger.info('starting load tester')

    const executeRandomTask = async (): Promise<void> => {
      const task = this.tasks[Math.floor(Math.random() * this.tasks.length)]
      this.logger.info(`${task.method}: ${task.url}`)
      try {
        await got<any>(task.url, { method: task.method, timeout: 10000 })
      } catch (ex) {
        this.logger.error(`${task.method}: ${task.url} failed.`, ex)
      } finally {
        if (this.running) {
          executeRandomTask()
        }
      }
    }

    this.logger.info(`using ${this.config.workerThreadCount} worker threads`)

    for (let i = 0; i < this.config.workerThreadCount; i += 1) {
      executeRandomTask()
    }
  }

  public async stop(): Promise<void> {
    this.running = false
  }
}
