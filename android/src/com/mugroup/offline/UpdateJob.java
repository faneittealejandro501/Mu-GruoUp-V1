package com.mugroup.offline;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;

public final class UpdateJob extends JobService {
    private static final int ID = 203;
    private JobParameters running;
    private Thread worker;

    static void schedule(Context context) {
        JobScheduler jobs = context.getSystemService(JobScheduler.class);
        if (jobs != null && jobs.getPendingJob(ID) == null) {
            jobs.schedule(new JobInfo.Builder(ID,new ComponentName(context,UpdateJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_UNMETERED)
                .setRequiresStorageNotLow(true)
                .setPeriodic(6 * 60 * 60 * 1000L)
                .build());
        }
    }

    @Override public boolean onStartJob(JobParameters params) {
        ClientUpdates updates = new ClientUpdates(this);
        running = params;
        worker = updates.check(() -> {
            updates.close();
            new Handler(Looper.getMainLooper()).post(() -> {
                if (running == params) {
                    running = null;
                    worker = null;
                    jobFinished(params,false);
                }
            });
        });
        if (worker != null) return true;
        updates.close();
        running = null;
        return false;
    }

    @Override public boolean onStopJob(JobParameters params) {
        running = null;
        if (worker != null) worker.interrupt();
        worker = null;
        return true;
    }
}
