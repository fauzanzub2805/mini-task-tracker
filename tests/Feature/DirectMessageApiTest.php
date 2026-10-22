<?php

namespace Tests\Feature;

use App\Models\DirectMessage;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class DirectMessageApiTest extends ApiTestCase
{
    private function send(User $sender, User $recipient, string $body): DirectMessage
    {
        return DirectMessage::create([
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'body' => $body,
        ]);
    }

    public function test_user_search_excludes_self_and_matches_name_case_insensitively(): void
    {
        $alice = User::factory()->create(['name' => 'Alice Wijaya']);
        $bob = User::factory()->create(['name' => 'Bob Saputra']);
        User::factory()->create(['name' => 'Carol']);

        $this->actingAs($alice);

        $all = $this->getJson('/messaging/users')->assertOk();
        $this->assertCount(2, $all->json('data'));
        $this->assertNotContains($alice->id, collect($all->json('data'))->pluck('id'));

        $this->getJson('/messaging/users?q=sap')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $bob->id)
            ->assertJsonPath('data.0.name', 'Bob Saputra');

        $this->getJson('/messaging/users?q=ALICE')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_user_directory_without_query_lists_existing_accounts_ordered_by_name_and_capped_at_fifty(): void
    {
        $alice = User::factory()->create(['name' => 'Alice Wijaya']);

        foreach (range(1, 55) as $index) {
            User::factory()->create(['name' => sprintf('Zeta %02d', $index)]);
        }

        $response = $this->actingAs($alice)->getJson('/messaging/users')->assertOk()->assertJsonCount(50, 'data');

        $names = collect($response->json('data'))->pluck('name')->all();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $sorted = $names;
        sort($sorted, SORT_STRING);

        $this->assertSame($sorted, $names, 'Direktori pengguna harus urut nama.');
        $this->assertSame('Zeta 01', $names[0]);
        $this->assertSame('Zeta 50', $names[49]);
        $this->assertNotContains($alice->id, $ids, 'Akun yang login tidak boleh muncul.');
    }

    public function test_conversation_list_orders_latest_and_reports_green_and_red_statuses(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $carol = $this->makeUser();

        $incomingUnread = $this->send($bob, $alice, 'Halo dari Bob');
        $this->send($alice, $bob, 'Balasan Alice');
        $carolMessage = $this->send($carol, $alice, 'Laporan Carol');

        $this->actingAs($alice)
            ->postJson("/messaging/users/{$carol->id}/read", ['through_id' => $carolMessage->id])
            ->assertOk()
            ->assertJsonPath('data.updated', 1);

        $response = $this->getJson('/messaging/conversations')->assertOk();

        // Percakapan dengan pesan terakhir paling baru tampil lebih dulu.
        $response->assertJsonPath('data.0.user.id', $carol->id)
            ->assertJsonPath('data.0.status', 'awaiting_reply') // merah: sudah dibaca, belum dibalas
            ->assertJsonPath('data.0.unread_count', 0)
            ->assertJsonPath('data.1.user.id', $bob->id)
            ->assertJsonPath('data.1.status', 'unread') // hijau: masih ada pesan masuk belum dibaca
            ->assertJsonPath('data.1.unread_count', 1)
            ->assertJsonPath('data.1.last_message', 'Balasan Alice')
            ->assertJsonPath('unread_count', 1);

        $this->assertNull($incomingUnread->fresh()->read_at);

        // Setelah pesan masuk Bob dibaca, pesan terakhir di percakapan itu adalah
        // balasan Alice (outgoing), jadi tidak ada indikator tersisa.
        $this->postJson("/messaging/users/{$bob->id}/read", ['through_id' => $incomingUnread->id])->assertOk();
        $this->getJson('/messaging/conversations')
            ->assertJsonPath('data.1.user.id', $bob->id)
            ->assertJsonPath('data.1.status', null)
            ->assertJsonPath('unread_count', 0);
    }

    public function test_conversation_search_matches_participant_name_and_message_body_only_within_own_chats(): void
    {
        $alice = $this->makeUser();
        $bob = User::factory()->create(['name' => 'Bob Saputra']);
        $carol = User::factory()->create(['name' => 'Carol']);
        $dave = User::factory()->create(['name' => 'Dave']);

        $this->send($bob, $alice, 'Pesan biasa');
        $this->send($carol, $alice, 'Topik rahasia bersama');
        $this->send($dave, $bob, 'Rahasia orang lain');

        $this->actingAs($alice);

        $this->getJson('/messaging/conversations?q=bob')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user.id', $bob->id);

        $this->getJson('/messaging/conversations?q=RAHASIA')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user.id', $carol->id);

        $this->getJson('/messaging/conversations?q=tidak-ada')->assertOk()->assertJsonCount(0, 'data');

        // Dave tidak pernah mengirim pesan ke Alice, jadi tidak muncul walau body cocok.
        $this->getJson('/messaging/conversations?q=orang')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_messages_endpoint_returns_latest_hundred_in_chronological_order(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();

        $ids = [];
        for ($i = 1; $i <= 105; $i++) {
            $ids[] = $this->send($alice, $bob, "pesan {$i}")->id;
        }
        $other = $this->makeUser();
        $this->send($bob, $other, 'bukan untuk alice');

        $this->actingAs($alice)
            ->getJson("/messaging/users/{$bob->id}/messages")
            ->assertOk()
            ->assertJsonCount(100, 'data')
            ->assertJsonPath('data.0.id', $ids[5])
            ->assertJsonPath('data.99.id', $ids[104])
            ->assertJsonPath('data.0.body', 'pesan 6')
            ->assertJsonPath('data.0.attachment', null)
            ->assertJsonPath('data.0.sender_id', $alice->id)
            ->assertJsonPath('data.0.recipient_id', $bob->id)
            ->assertJsonStructure(['data' => [['id', 'sender_id', 'recipient_id', 'body', 'created_at', 'read_at', 'attachment']]]);
    }

    public function test_store_validates_body_and_attachment_safety(): void
    {
        Storage::fake('local');

        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $this->actingAs($alice);

        $this->postJson("/messaging/users/{$bob->id}/messages", [])->assertUnprocessable();
        $this->postJson("/messaging/users/{$bob->id}/messages", ['body' => '   '])->assertUnprocessable();
        $this->postJson("/messaging/users/{$bob->id}/messages", ['body' => str_repeat('a', 4001)])->assertUnprocessable();

        foreach (['evil.html' => 'text/html', 'evil.svg' => 'image/svg+xml', 'evil.exe' => 'application/x-msdownload'] as $name => $mime) {
            $this->post("/messaging/users/{$bob->id}/messages", [
                'body' => 'lihat file',
                'attachment' => UploadedFile::fake()->create($name, 10, $mime),
            ], ['Accept' => 'application/json'])->assertUnprocessable();
        }

        $this->post("/messaging/users/{$bob->id}/messages", [
            'attachment' => UploadedFile::fake()->create('besar.pdf', 10241, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable();

        $this->postJson("/messaging/users/{$bob->id}/messages", ['body' => 'Halo Bob'])
            ->assertCreated()
            ->assertJsonPath('data.body', 'Halo Bob')
            ->assertJsonPath('data.read_at', null)
            ->assertJsonPath('data.attachment', null);

        $withFile = $this->post("/messaging/users/{$bob->id}/messages", [
            'attachment' => UploadedFile::fake()->create('laporan.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $withFile->assertJsonPath('data.body', null)
            ->assertJsonPath('data.attachment.name', 'laporan.pdf')
            ->assertJsonPath('data.attachment.size', 102400);

        $this->assertStringContainsString('/messaging/messages/', $withFile->json('data.attachment.url'));

        $this->assertSame(2, DirectMessage::where('sender_id', $alice->id)->where('recipient_id', $bob->id)->count());
        $this->assertNotEmpty(DirectMessage::whereNotNull('attachment_path')->value('attachment_path'));
    }

    public function test_read_marks_only_incoming_messages_up_to_through_id(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $carol = $this->makeUser();

        $first = $this->send($bob, $alice, 'pertama');
        $second = $this->send($bob, $alice, 'kedua');
        $fromCarol = $this->send($carol, $alice, 'dari carol');
        $outgoing = $this->send($alice, $bob, 'balasan');

        $this->actingAs($alice)
            ->postJson("/messaging/users/{$bob->id}/read", ['through_id' => $first->id])
            ->assertOk()
            ->assertJsonPath('data.updated', 1);

        $this->assertNotNull($first->fresh()->read_at);
        $this->assertNull($second->fresh()->read_at);
        $this->assertNull($fromCarol->fresh()->read_at);
        $this->assertNull($outgoing->fresh()->read_at);

        $this->postJson("/messaging/users/{$bob->id}/read", ['through_id' => $second->id])
            ->assertOk()
            ->assertJsonPath('data.updated', 1);

        $this->assertNotNull($second->fresh()->read_at);
        $this->assertNull($fromCarol->fresh()->read_at);

        // through_id yang sangat besar tetap tidak menyentuh pesan pengirim lain.
        $this->postJson("/messaging/users/{$bob->id}/read", ['through_id' => 999999])->assertOk();
        $this->assertNull($fromCarol->fresh()->read_at);

        $this->postJson("/messaging/users/{$bob->id}/read", [])->assertUnprocessable();
        $this->postJson("/messaging/users/{$bob->id}/read", ['through_id' => 0])->assertUnprocessable();
    }

    public function test_attachment_download_is_private_and_delete_is_sender_only(): void
    {
        Storage::fake('local');

        $alice = $this->makeUser();
        $bob = $this->makeUser();
        $charlie = $this->makeUser();

        $this->actingAs($alice)->post("/messaging/users/{$bob->id}/messages", [
            'body' => 'file untuk bob',
            'attachment' => UploadedFile::fake()->create('dokumen.pdf', 12, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $message = DirectMessage::latest('id')->firstOrFail();
        $this->assertNotNull($message->attachment_path);

        $this->get("/messaging/messages/{$message->id}/attachment")->assertOk()->assertDownload('dokumen.pdf');

        $this->actingAs($charlie)->get("/messaging/messages/{$message->id}/attachment")->assertForbidden();
        $this->getJson("/messaging/users/{$alice->id}/messages")->assertOk();

        $this->actingAs($bob)->deleteJson("/messaging/messages/{$message->id}")->assertForbidden();
        $this->actingAs($bob)->get("/messaging/messages/{$message->id}/attachment")->assertOk();

        $this->actingAs($alice)->deleteJson("/messaging/messages/{$message->id}")->assertNoContent();
        $this->assertDatabaseMissing('direct_messages', ['id' => $message->id]);
        Storage::disk('local')->assertMissing($message->attachment_path);
    }

    public function test_self_conversation_is_rejected_and_guests_are_unauthenticated(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();

        $this->getJson("/messaging/users/{$alice->id}/messages")->assertUnauthorized();
        $this->getJson('/messaging/conversations')->assertUnauthorized();
        $this->getJson('/messaging/users')->assertUnauthorized();

        $this->actingAs($alice);

        $this->getJson("/messaging/users/{$alice->id}/messages")->assertUnprocessable();
        $this->postJson("/messaging/users/{$alice->id}/messages", ['body' => 'hai'])->assertUnprocessable();
        $this->postJson("/messaging/users/{$alice->id}/read", ['through_id' => 1])->assertUnprocessable();

        $this->getJson("/messaging/users/{$bob->id}/messages")->assertOk();
    }

    public function test_csrf_token_is_required_for_message_mutations(): void
    {
        $alice = $this->makeUser();
        $bob = $this->makeUser();

        // Lingkungan testing melewati CSRF; uji middleware secara nyata dengan
        // mengubah environment agar token benar-benar diperiksa.
        $this->app['env'] = 'local';
        $this->actingAs($alice);

        $this->post("/messaging/users/{$bob->id}/messages", ['body' => 'tanpa token'], ['Accept' => 'application/json'])
            ->assertStatus(419);

        $this->assertSame(0, DirectMessage::count());

        $token = 'csrf-token-uji';

        $this->withSession(['_token' => $token])
            ->post("/messaging/users/{$bob->id}/messages", [
                'body' => 'dengan token',
                '_token' => $token,
            ], ['Accept' => 'application/json'])
            ->assertCreated();

        $this->assertSame(1, DirectMessage::count());
    }
}
