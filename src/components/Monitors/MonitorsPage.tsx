import React, { ComponentState } from 'react';
import ReactGA from 'react-ga';
import { Props } from '../../common/withThreadDumps';
import ThreadDump from '../../types/ThreadDump';
import Monitor from './Monitor';
import MonitorOverTime from './MonitorOverTime';
import MonitorOverTimeItem from './MonitorOverTimeItem';
import './MonitorsPage.css';
import MonitorsSettings from './MonitorsSettings';

type State = {
  withOwner: boolean;
  withoutIdle: boolean;
  withoutOwner: boolean;
};

export default class MonitorsPage extends React.PureComponent<Props, State> {
  // tslint:disable-next-line:max-line-length
  private static NO_THREAD_DUMPS = 'You need to load the <i>thread_dump</i> files to see this data.';
  private static N0_THREADS_MATCHING = 'No monitors match the selected criteria.';

  public state: State = {
    withOwner: false,
    withoutIdle: true,
    withoutOwner: false,
  };

  public render() {
    const monitors = this.getMonitorsOverTime(this.props.threadDumps);
    const filtered = this.filterMonitors(monitors);

    return (
      <div id="monitors-page">
        <MonitorsSettings
          withOwner={this.state.withOwner}
          withoutIdle={this.state.withoutIdle}
          withoutOwner={this.state.withoutOwner}
          onFilterChange={this.handleFilterChange} />

        {!this.props.threadDumps.find(dump => dump.threads.length > 0)
          ? <h4 dangerouslySetInnerHTML={{ __html: MonitorsPage.NO_THREAD_DUMPS }} />
          : filtered.length === 0
            ? <h4>{MonitorsPage.N0_THREADS_MATCHING}</h4>
            : filtered.map(monitor => <MonitorOverTimeItem key={monitor.id} monitor={monitor} />)}
      </div>
    );
  }

  private handleFilterChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const name: string = event.target.name;
    const isChecked: boolean = event.target.checked;
    const newState: ComponentState = { [name]: isChecked };

    ReactGA.event({
      action: 'Monitors settings changed',
      category: 'Navigation',
      label: `Filter ${name} changed to ${isChecked}`,
    });
    this.setState(newState);
  }

  private getMonitorsOverTime = (threadDumps: ThreadDump[]): MonitorOverTime[] => {
    const monitorsOverTime: Map<string, MonitorOverTime> = new Map();

    threadDumps.forEach((threadDump) => {
      threadDump.locks.forEach((lock) => {
        const monitor = new Monitor(threadDump, lock);

        let monitorOverTime = monitorsOverTime.get(lock.id);
        if (!monitorOverTime) {
          monitorOverTime = new MonitorOverTime(lock.id);
          monitorsOverTime.set(lock.id, monitorOverTime);
        }

        monitorOverTime.monitors.push(monitor);
        monitorOverTime.waitingSum += monitor.waiting.length;
      });
    });

    return Array
      .from(monitorsOverTime.values())
      .sort((m1, m2) => m2.waitingSum - m1.waitingSum);
  }

  private filterMonitors = (monitors: MonitorOverTime[]) => {
    let filtered = monitors.filter(monitor => monitor.waitingSum > 0);

    if (this.state.withoutIdle) {
      filtered = filtered.filter(monitor => !this.isQueueThread(monitor));
    }
    if (this.state.withOwner) {
      filtered = filtered.filter(monitor => this.hasAnyOwner(monitor));
    }
    if (this.state.withoutOwner) {
      filtered = filtered.filter(monitor => !this.hasAnyOwner(monitor));
    }

    return filtered;
  }

  private hasAnyOwner = (monitorOverTime: MonitorOverTime): boolean => {
    return monitorOverTime.monitors.find(monitor => monitor.owner !== null) !== undefined;
  }

  private isQueueThread = (monitorOverTime: MonitorOverTime): boolean => {
    for (const monitor of monitorOverTime.monitors) {
      // if the lock has an owner, it's not a queue thread
      if (monitor.owner !== null) {
        return false;
      }

      // if the stack trace is too long, it's not a queue thread
      for (const thread of monitor.waiting) {
        if (thread.stackTrace.length > 11) {
          return false;
        }
      }
    }
    return true;
  }
}
