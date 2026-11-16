import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { JWT_SECRET } from '../src/middleware/auth';
import { playbackSessionCoordinator } from '../src/services/playbackSession.service';

const makeToken = (userId: string, email: string) =>
  jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });

describe('Single Active Playback Device & Multi-Device Remote Coordinator', () => {
  afterEach(() => {
    playbackSessionCoordinator.resetForTests();
  });

  it('allows only one active playing device per account when multiple devices log in', async () => {
    const token = makeToken('user_multi_1', 'listener@syncwave.app');

    const regA = await request(app)
      .post('/api/playback-session/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceId: 'dev_web_laptop', deviceName: 'Chrome on Windows', platform: 'WEB' });

    expect(regA.status).toBe(200);
    expect(regA.body.session.activeDeviceId).toBe('dev_web_laptop');
    expect(regA.body.session.devices).toHaveLength(1);

    const regB = await request(app)
      .post('/api/playback-session/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceId: 'dev_android_phone', deviceName: 'Pixel 9 Pro', platform: 'ANDROID' });

    expect(regB.status).toBe(200);
    expect(regB.body.session.activeDeviceId).toBe('dev_web_laptop');
    expect(regB.body.session.devices).toHaveLength(2);
    expect(regB.body.session.devices.find((d: any) => d.deviceId === 'dev_android_phone').isActive).toBe(false);

    // Non-active remote device attempting to publish competing playback is rejected with 409
    const blockedState = await request(app)
      .post('/api/playback-session/state')
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceId: 'dev_android_phone', isPlaying: true, positionSec: 12 });

    expect(blockedState.status).toBe(409);
    expect(blockedState.body.code).toBe('NOT_ACTIVE_DEVICE');
    expect(blockedState.body.activeDeviceId).toBe('dev_web_laptop');
  });

  it('routes remote commands from non-active devices to the active player and wakes long-poll', async () => {
    const token = makeToken('user_multi_2', 'remote@syncwave.app');

    await request(app)
      .post('/api/playback-session/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceId: 'dev_laptop', deviceName: 'Desktop Browser', platform: 'WEB' });

    await request(app)
      .post('/api/playback-session/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceId: 'dev_mobile', deviceName: 'Mobile Remote', platform: 'MOBILE_RN' });

    // Start long-poll on active device before remote issues command
    const pollPromise = request(app)
      .get('/api/playback-session/poll')
      .query({ deviceId: 'dev_laptop', sinceRevision: '2', timeoutMs: '4000' })
      .set('Authorization', `Bearer ${token}`);

    await new Promise((r) => setTimeout(r, 30));

    const cmdRes = await request(app)
      .post('/api/playback-session/command')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceId: 'dev_mobile',
        type: 'PLAY_TRACK',
        payload: {
          track: {
            id: 'yt_test1234567',
            title: 'En Kannukulla',
            artist: 'G.V. Prakash Kumar',
            durationMs: 245000,
          },
        },
      });

    expect(cmdRes.status).toBe(200);
    expect(cmdRes.body.command.targetDeviceId).toBe('dev_laptop');

    const pollRes = await pollPromise;
    expect(pollRes.status).toBe(200);
    expect(pollRes.body.session.commands).toHaveLength(1);
    expect(pollRes.body.session.commands[0].type).toBe('PLAY_TRACK');
    const cmdSeq = pollRes.body.session.commands[0].seq;

    // Acknowledging seq removes consumed command
    const ackRes = await request(app)
      .get('/api/playback-session')
      .query({ deviceId: 'dev_laptop', ackSeq: String(cmdSeq) })
      .set('Authorization', `Bearer ${token}`);

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.session.commands).toHaveLength(0);
  });

  it('transfers active playback device, emits STOP_LOCAL to previous player, and isolates accounts', async () => {
    const tokenUser1 = makeToken('user_multi_3', 'u1@syncwave.app');
    const tokenUser2 = makeToken('user_other_9', 'u2@syncwave.app');

    await request(app)
      .post('/api/playback-session/devices/register')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({ deviceId: 'dev_a', deviceName: 'Web Studio', platform: 'WEB' });

    await request(app)
      .post('/api/playback-session/devices/register')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({ deviceId: 'dev_b', deviceName: 'Android Phone', platform: 'ANDROID' });

    // Active Device A publishes active track and position
    const pubRes = await request(app)
      .post('/api/playback-session/state')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({
        deviceId: 'dev_a',
        isPlaying: true,
        positionSec: 84,
        durationSec: 230,
        track: { id: 'song_1', title: 'Nenjukkul Peidhidum', artist: 'Harris Jayaraj', durationMs: 230000 },
      });
    expect(pubRes.status).toBe(200);

    // User 2 cannot hijack User 1's device
    const crossAccountRes = await request(app)
      .post('/api/playback-session/transfer')
      .set('Authorization', `Bearer ${tokenUser2}`)
      .send({ deviceId: 'dev_attacker', targetDeviceId: 'dev_b' });
    expect(crossAccountRes.status).toBe(404);

    // Device B selects itself as playing device
    const transferRes = await request(app)
      .post('/api/playback-session/transfer')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({ deviceId: 'dev_b', targetDeviceId: 'dev_b' });

    expect(transferRes.status).toBe(200);
    expect(transferRes.body.session.activeDeviceId).toBe('dev_b');

    // Old Device A receives STOP_LOCAL
    const pollOld = await request(app)
      .get('/api/playback-session')
      .query({ deviceId: 'dev_a' })
      .set('Authorization', `Bearer ${tokenUser1}`);
    expect(pollOld.body.session.commands.some((c: any) => c.type === 'STOP_LOCAL')).toBe(true);

    // New Device B receives SYNC_TAKEOVER at preserved positionSec
    const pollNew = await request(app)
      .get('/api/playback-session')
      .query({ deviceId: 'dev_b' })
      .set('Authorization', `Bearer ${tokenUser1}`);
    const takeover = pollNew.body.session.commands.find((c: any) => c.type === 'SYNC_TAKEOVER');
    expect(takeover).toBeDefined();
    expect(takeover.payload.positionSec).toBe(84);
    expect(takeover.payload.isPlaying).toBe(true);
  });
});
