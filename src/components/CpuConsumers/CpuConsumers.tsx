import React from 'react';
import ThreadDumpsUtils from '../../common/ThreadDumpsUtils';
import Thread from '../../types/Thread';
import ThreadDump from '../../types/ThreadDump';
import CpuConsumer from './CpuConsumer';
import CpuConsumersList from './CpuConsumersList';
import CpuConsumersSettings from './CpuConsumersSettings';

export enum CpuConsumersMode {
  Mean,
  Median,
  Max
}

type CpuConsumersProps = {
  threadDumps: ThreadDump[];
}

type CpuConsumersState = {
  mode: CpuConsumersMode;
  limit: number;
  consumers: CpuConsumer[];
}

export default class CpuConsumers extends React.Component<CpuConsumersProps, CpuConsumersState> {
  public state: CpuConsumersState = {
    consumers: [],
    limit: 40,
    mode: CpuConsumersMode.Mean
  };

  public componentDidMount() {
    this.calculateConsumers(this.state.mode);
  }

  public handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const mode: CpuConsumersMode = parseInt(event.target.value, 10);
    this.setState({ mode });
    this.calculateConsumers(mode);
  }

  public handleLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const limit: number = parseInt(event.target.value, 10);
    this.setState({ limit });
  }

  public calculateConsumers(mode: CpuConsumersMode) {
    const consumers: CpuConsumer[] = [];
    const threadsOverTime = ThreadDumpsUtils.getThreadsOverTime(this.props.threadDumps);

    for (const [id, threads] of threadsOverTime) {
      consumers.push(new CpuConsumer(this.calculateValueFromThreads(threads, mode), threads))
    }
    consumers.sort((a, b) => b.calculatedValue - a.calculatedValue);

    this.setState({ consumers });
  }

  public render() {
    return (
      <div className="content">
        <CpuConsumersSettings
          mode={this.state.mode}
          limit={this.state.limit}
          onModeChange={this.handleModeChange}
          onLimitChange={this.handleLimitChange}
        />
        <CpuConsumersList
          limit={this.state.limit}
          dumpsNumber={this.props.threadDumps.length}
          consumers={this.state.consumers}
        />
      </div>
    )
  }

  private calculateValueFromThreads(threadsMap: Map<number, Thread>, mode: CpuConsumersMode): number {
    const threads = Array.from(threadsMap.values());

    switch (mode) {
      case CpuConsumersMode.Mean:
        return threads.reduce(this.reduceSum, 0) / this.props.threadDumps.length;
      case CpuConsumersMode.Median:
        return this.calculateMedian(threads);
      case CpuConsumersMode.Max:
        return threads.reduce(this.reduceMax, 0);
    }
  }

  private reduceSum(sum: number, currentThread: Thread): number {
    return sum + currentThread.cpuUsage
  }

  private reduceMax(maxValue: number, currentThread: Thread): number {
    return (currentThread.cpuUsage > maxValue) ? currentThread.cpuUsage : maxValue
  }

  private calculateMedian(threads: Thread[]): number {
    const values = threads.slice();
    values.sort((a, b) => a.cpuUsage - b.cpuUsage);
    const lowMiddle = Math.floor((values.length - 1) / 2);
    const highMiddle = Math.ceil((values.length - 1) / 2);
    return (values[lowMiddle].cpuUsage + values[highMiddle].cpuUsage) / 2;
  }
}