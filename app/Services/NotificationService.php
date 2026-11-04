<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\Comment;
use App\Models\DirectMessage;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class NotificationService
{
    public function send(int $recipient, ?int $actor, array $data): void
    {
        if ($recipient === $actor) {
            return;
        }
        AppNotification::create(['user_id' => $recipient] + $data);
    }

    public function message(DirectMessage $message, User $sender): void
    {
        $this->send($message->recipient_id, $sender->id, [
            'message_id' => $message->id, 'type' => 'message.received',
            'title' => 'Pesan masuk', 'body' => "{$sender->name} mengirim pesan baru.",
            'url' => '/profile/messages?user='.$sender->id,
        ]);
    }

    public function projectAdded(Project $project, int $recipient, User $actor): void
    {
        $this->send($recipient, $actor->id, [
            'project_id' => $project->id, 'type' => 'project.member_added',
            'title' => 'Anda ditambahkan ke project',
            'body' => "{$actor->name} menambahkan Anda ke project {$project->name}.",
            'url' => '/projects/'.$project->id,
        ]);
    }

    public function taskEvent(Task $task, User $actor, array $recipients, string $type, string $title, string $body): void
    {
        // Former project members may still be present in legacy assignment pivots.
        $allowed = User::whereIn('id', array_unique($recipients))->get()
            ->filter(fn (User $user) => $user->can('view', $task));
        foreach ($allowed as $user) {
            $this->send($user->id, $actor->id, [
                'project_id' => $task->project_id, 'task_id' => $task->id,
                'type' => $type, 'title' => $title, 'body' => $body,
                'url' => "/projects/{$task->project_id}/tasks/{$task->id}".($type === 'comment.mentioned' ? '?tab=comments' : ''),
            ]);
        }
    }

    public function mentions(Comment $comment, Task $task, User $actor): void
    {
        $this->taskEvent($task, $actor, $comment->mentions()->pluck('users.id')->all(),
            'comment.mentioned', 'Anda disebut dalam komentar', "{$actor->name} menyebut Anda pada task {$task->title}.");
    }

    public function refreshDeadlines(User $user): void
    {
        $today = now(config('notifications.timezone'))->toDateString();
        // Serialize per recipient so concurrent tabs cannot duplicate reminders or race cleanup.
        DB::transaction(function () use ($user, $today) {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $tasks = Task::query()->assignedTo($user->id)->where('status', '!=', Task::STATUS_DONE)
                ->whereDate('due_date', '<=', $today)
                ->whereHas('project', fn ($q) => $q->visibleTo($user))->get();
            $keys = [];
            foreach ($tasks as $task) {
                $due = $task->due_date->toDateString();
                $kind = $due === $today ? 'task.due_today' : 'task.overdue';
                $key = "{$kind}:{$task->id}:{$due}";
                $keys[] = $key;
                AppNotification::firstOrCreate(['user_id' => $user->id, 'event_key' => $key], [
                    'project_id' => $task->project_id, 'task_id' => $task->id, 'type' => $kind,
                    'title' => $due === $today ? 'Deadline task hari ini' : 'Task melewati deadline',
                    'body' => "{$task->title} — deadline {$due}.",
                    'url' => "/projects/{$task->project_id}/tasks/{$task->id}",
                ]);
            }
            AppNotification::where('user_id', $user->id)->whereIn('type', ['task.due_today', 'task.overdue'])
                ->whereNotIn('event_key', $keys)->delete();
        });
    }
}
