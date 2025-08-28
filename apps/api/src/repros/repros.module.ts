import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReprosController } from './repros.controller';
import { ReprosService } from './services/repros.service';
import { Repro } from '../reports/entities/repro.entity';
import { Step } from '../reports/entities/step.entity';
import { Run } from '../reports/entities/run.entity';
import { Report } from '../reports/entities/report.entity';
import { Signal } from '../reports/entities/signal.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Repro,
            Step,
            Run,
            Report,
            Signal,
        ]),
    ],
    controllers: [ReprosController],
    providers: [ReprosService],
    exports: [ReprosService],
})
export class ReprosModule { }
