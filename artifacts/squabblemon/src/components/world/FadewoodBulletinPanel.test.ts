import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import type { PlayerBootstrap, PlayerMission } from '@workspace/api-client-react';
import { bulletinBoard } from '../../content/bulletinBoard';
import { FadewoodBulletinPanel } from './FadewoodBulletinPanel';

const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
const mission = (id: string, status: PlayerMission['status']): PlayerMission => ({ id, status, cadence: 'daily',
  title: `Bounty ${id}`, description: 'Saved mission description', progress: status === 'claimable' ? 5 : 2, goal: 5,
  rewardCurrency: status === 'claimable' ? 'packTickets' : 'softCurrency', rewardAmount: status === 'claimable' ? 2 : 125, resetAt: null });
// This presentation component intentionally reads only authoritative mission summaries.
const bootstrap = (missions: PlayerMission[]) => ({ missions }) as PlayerBootstrap;

test('the world bulletin preserves canonical availability and routes without claiming or retaining another account', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  const account = bootstrap([mission('active', 'active'), mission('ready/one', 'claimable'), mission('claimed', 'claimed')]);
  const before = JSON.stringify(account);
  const routes: string[] = [];
  let closed = 0;
  const props = { bootstrap: account, onNavigate: (route: string) => routes.push(route), onClose: () => { closed++; }, titleId: 'world-board-title' };
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => { renderer = create(React.createElement(FadewoodBulletinPanel, props)); });
    const buttons = () => renderer!.root.findAllByType('button');
    const button = (label: string) => buttons().find(item => text(item) === label || item.findAllByType('strong').some(child => text(child) === label))!;
    const flyers = new Map<string, ReactTestInstance>();
    for (const event of bulletinBoard.events) {
      const flyer = renderer!.root.findAllByType('article').find(item => item.findAllByType('h4').some(heading => text(heading) === event.title));
      assert.ok(flyer, `missing canonical event ${event.id}`);
      flyers.set(event.id, flyer);
      assert.equal(flyer.props['data-status'], event.status);
      assert.ok(text(flyer).includes(event.statusLabel), event.id);
      assert.ok(text(flyer).includes(event.summary), event.id);
      const link = flyer.findByType('button');
      assert.equal(text(link), event.link.label);
      await act(async () => { link.props.onClick(); });
      assert.equal(routes.at(-1), event.link.href, 'event routing uses its existing published destination');
    }
    const beta = flyers.get('kumite-breakthrough-beta')!;
    assert.equal(beta.props['data-status'], 'planned');
    assert.match(text(beta), /Public matchmaking not yet open/);
    assert.match(text(beta), /Three lanes\. Refilling Motion\. Two breaches to win\./);
    assert.equal(text(beta.findByType('button')), 'Explore Kumite');
    const planned = flyers.get('ranked-fight-night')!;
    assert.equal(planned.props['data-status'], 'planned');
    assert.match(text(planned), /Planned · No date set/);
    assert.match(text(planned), /There is no date or reward yet/);
    const missionButtons = buttons().filter(item => String(item.props['aria-label'] ?? '').startsWith('Open bounty:'));
    assert.equal(missionButtons.length, 2);
    assert.match(text(missionButtons[0]), /ready\/one.*Ready to collect.*2 Tickets/);
    assert.match(text(missionButtons[1]), /2 \/ 5.*125 Clout/);
    await act(async () => { missionButtons[0].props.onClick(); });
    assert.equal(routes.at(-1), '/game/missions?mission=ready%2Fone');
    await act(async () => { button('Full Events board').props.onClick(); button('Open Bounties').props.onClick(); });
    assert.deepEqual(routes.slice(-2), ['/game/events', '/game/missions']);
    assert.equal(JSON.stringify(account), before, 'opening the board and following links never changes mission authority');
    assert.equal(renderer!.root.findAllByProps({ role: 'dialog' }).length, 0, 'the host retains the single dialog lifecycle');
    await act(async () => { renderer!.update(React.createElement(FadewoodBulletinPanel, { ...props, bootstrap: bootstrap([]) })); });
    assert.match(text(renderer!.root), /Your bounty board is quiet/);
    assert.equal(buttons().some(item => String(item.props['aria-label'] ?? '').startsWith('Open bounty:')), false);
    await act(async () => { buttons().find(item => item.props['aria-label'] === 'Close events and bounties')!.props.onClick(); });
    assert.equal(closed, 1);
  } finally {
    if (renderer) await act(async () => { renderer!.unmount(); });
    if (previous) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previous);
    else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  }
});
