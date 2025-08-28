import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mapping } from './entities/mapping.entity';
import { DocChunk } from './entities/doc-chunk.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Mapping, DocChunk])],
    controllers: [SearchController],
    providers: [SearchService],
    exports: [SearchService],
})
export class SearchModule { }
