import { ConflictException, HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { SecIxbrlClient, IXBRL_MAX_SOURCE_BYTES, IxbrlView } from '../../lib/sec-ixbrl/sec-ixbrl.client';
import { Filing } from '../entity/filing.entity';

@Injectable()
export class SecIxbrlService {
  constructor(@InjectRepository(Filing) private readonly filings: Repository<Filing>, @Inject(SecIxbrlClient) private readonly client: SecIxbrlClient) { }

  async inspect(cik: string, accessionNo: string, view: IxbrlView, expectedHash?: string, query: Record<string, string> = {}) {
    const filing = await this.filings.createQueryBuilder('filing')
      .select(['filing.cik', 'filing.accessionNo', 'filing.status', 'filing.checksum', 'filing.documentSizeBytes'])
      .addSelect('filing.documentContent').where({ cik, accessionNo }).getOne();
    if (!filing) throw new NotFoundException('Stored SEC filing not found');
    if (filing.status !== 'downloaded' || !filing.documentContent || !filing.checksum) throw new ConflictException('SEC original document has not been downloaded');
    if (Buffer.byteLength(filing.documentContent, 'utf8') > IXBRL_MAX_SOURCE_BYTES) throw new HttpException('SEC original document exceeds 32 MiB', 413);
    const sourceHash = createHash('sha256').update(filing.documentContent, 'utf8').digest('hex');
    if (sourceHash !== filing.checksum || (expectedHash !== undefined && expectedHash !== sourceHash)) throw new ConflictException('SEC original document changed; reload iXBRL metadata');
    return this.client.extract(view, { cik, accessionNo, sourceHtml: filing.documentContent, sourceHash }, query);
  }
}
