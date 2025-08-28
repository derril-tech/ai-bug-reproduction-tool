import { Controller, Post, Get, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { SearchService } from './search.service';
import { CreateMappingDto } from './dto/create-mapping.dto';

@Controller('v1/mappings')
export class SearchController {
    constructor(private readonly searchService: SearchService) { }

    @Post()
    async createMapping(@Body() createMappingDto: CreateMappingDto) {
        return this.searchService.createMapping(createMappingDto);
    }

    @Get('report/:reportId')
    async getMappingByReportId(@Param('reportId', ParseUUIDPipe) reportId: string) {
        return this.searchService.findMappingByReportId(reportId);
    }

    @Get('search/:projectId')
    async searchDocuments(
        @Param('projectId', ParseUUIDPipe) projectId: string,
        @Body('query') query: string,
        @Body('limit') limit: number = 5,
    ) {
        return this.searchService.searchDocuments(projectId, query, limit);
    }
}
