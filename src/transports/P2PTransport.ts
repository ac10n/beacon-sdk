import * as sodium from 'libsodium-wrappers'
import { Logger } from '../utils/Logger'
import { ConnectionContext } from '../types/ConnectionContext'
import {
  Storage,
  StorageKey,
  TransportStatus,
  Transport,
  TransportType,
  P2PCommunicationClient,
  Origin,
  P2PPairingRequest
} from '..'
import { PeerManager } from '../managers/PeerManager'
import { ExtendedP2PPairingResponse } from '../types/P2PPairingResponse'

const logger = new Logger('P2PTransport')

export class P2PTransport<
  T extends P2PPairingRequest | ExtendedP2PPairingResponse,
  K extends StorageKey.TRANSPORT_P2P_PEERS_DAPP | StorageKey.TRANSPORT_P2P_PEERS_WALLET
> extends Transport<T, K, P2PCommunicationClient> {
  public readonly type: TransportType = TransportType.P2P

  constructor(
    name: string,
    keyPair: sodium.KeyPair,
    storage: Storage,
    matrixNodes: string[],
    storageKey: K
  ) {
    super(
      name,
      new P2PCommunicationClient(name, keyPair, 1, storage, matrixNodes),
      new PeerManager<K>(storage, storageKey)
    )
  }

  public static async isAvailable(): Promise<boolean> {
    return Promise.resolve(true)
  }

  public async connect(): Promise<void> {
    if (this._isConnected !== TransportStatus.NOT_CONNECTED) {
      return
    }

    logger.log('connect')
    this._isConnected = TransportStatus.CONNECTING

    await this.client.start()

    const knownPeers = await this.getPeers()

    if (knownPeers.length > 0) {
      logger.log('connect', `connecting to ${knownPeers.length} peers`)
      const connectionPromises = knownPeers.map(async (peer) => this.listen(peer.publicKey))
      Promise.all(connectionPromises).catch(console.log)
    }

    await this.startOpenChannelListener()

    await super.connect()
  }

  public async startOpenChannelListener(): Promise<void> {
    //
  }

  public async getPairingRequestInfo(): Promise<P2PPairingRequest> {
    return this.client.getPairingRequestInfo()
  }

  public async listen(publicKey: string): Promise<void> {
    await this.client
      .listenForEncryptedMessage(publicKey, (message) => {
        const connectionContext: ConnectionContext = {
          origin: Origin.P2P,
          id: publicKey
        }

        this.notifyListeners(message, connectionContext).catch((error) => {
          throw error
        })
      })
      .catch((error) => {
        throw error
      })
  }
}
