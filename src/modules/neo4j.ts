import neo4j, { Driver, QueryResult, Result, Transaction } from 'neo4j-driver'

let driver: Driver;

const { NEO4J_DATABASE } = process.env


export async function createDriver(host: string, username: string, password: string): Promise<Driver> {
    const driver = neo4j.driver(host, neo4j.auth.basic(username, password), {
        disableLosslessIntegers: true
    })

    await driver.verifyConnectivity()

    return driver
}

export async function read(query: string, params?: Record<string, any>, database: string | undefined = NEO4J_DATABASE): Promise<Result> {
    const session = driver.session({ database })

    const res = await session.readTransaction(tx => {
        return tx.run(query, params)
    })

    await session.close()

    return res
}

export async function write(query: string, params?: Record<string, any>, database: string | undefined = NEO4J_DATABASE): Promise<Result> {
    const session = driver.session({ database })

    const res = await session.writeTransaction(tx => {
        return tx.run(query, params)
    })

    await session.close()

    return res
}

export async function writeTransaction(work: (tx: Transaction) => void, database: string | undefined = NEO4J_DATABASE): Promise<void> {
    const session = driver.session({ database, defaultAccessMode: 'WRITE' })

    const res = await session.writeTransaction(work)

    await session.close()

    return res
}

export async function close() {
    return driver && driver.close()
}

export default async function initNeo4j(host: string, username: string, password: string): Promise<Driver> {
    driver = await createDriver(host, username, password)

    return driver
}