import { AppError } from "../../shared/errors";
import type { AdapterRegistry } from "../../adapters/channel-adapter";
import type { ChannelAdapter } from "../../adapters/channel-adapter";
import type { ChannelAccount, CreateChannelAccountInput } from "./channel.types";
import { ChannelRepository } from "./channel.repository";

export class ChannelService {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly adapters: AdapterRegistry
  ) {}

  listAccounts() {
    return this.channels.list();
  }

  createAccount(input: CreateChannelAccountInput) {
    this.adapters.get(input.channelType);
    return this.channels.create(input);
  }

  async getAccount(id: string): Promise<ChannelAccount> {
    const account = await this.channels.findById(id);
    if (!account) {
      throw new AppError("CHANNEL_NOT_FOUND", "Channel account not found", 404);
    }
    return account;
  }

  getAdapter(account: ChannelAccount): ChannelAdapter {
    return this.adapters.get(account.channelType);
  }
}
