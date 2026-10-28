// Import Mongoose models
const { Announcement, SystemSetting, AuditLog } = require('../models');
const { computeDurationMinutes } = require('../validators/announcement.validator');

/**
 * Announcement Service
 * Encapsulates all business logic for platform-wide broadcast announcements,
 * scheduling, server-authoritative active window evaluation, and audit logging.
 */
class AnnouncementService {
  /**
   * Evaluate dynamic effective status of an announcement doc
   */
  deriveEffectiveStatus(announcement, now = new Date()) {
    if (!announcement) return 'none';
    if (announcement.cancelledAt || announcement.status === 'cancelled') return 'cancelled';
    if (announcement.status === 'draft') return 'draft';
    if (announcement.expiryDate && now >= new Date(announcement.expiryDate)) return 'expired';
    if (announcement.startDate && now < new Date(announcement.startDate)) return 'scheduled';
    if (announcement.startDate && announcement.expiryDate &&
        new Date(announcement.startDate) <= now && now < new Date(announcement.expiryDate)) {
      return 'published';
    }
    return announcement.status || 'draft';
  }

  /**
   * Retrieve currently active announcement for non-admin and general client consumption.
   * Server time is authoritative. Drafts, expired, and cancelled announcements are excluded.
   * Only public presentation fields are returned to prevent internal leakage.
   */
  async getActiveAnnouncement(userRole = null) {
    const now = new Date();

    // Query for active announcements based on authoritative server clock
    const query = {
      status: { $in: ['published', 'scheduled'] },
      startDate: { $lte: now },
      expiryDate: { $gt: now },
      cancelledAt: null,
    };

    // Filter by audience strictly based on user role and authentication state
    if (!userRole) {
      query.targetAudience = 'all';
    } else if (userRole === 'admin') {
      query.targetAudience = { $in: ['all', 'admins'] };
    } else if (userRole === 'instructor') {
      query.targetAudience = { $in: ['all', 'instructors'] };
    } else if (userRole === 'student') {
      query.targetAudience = { $in: ['all', 'students'] };
    } else {
      query.targetAudience = 'all';
    }

    const activeDoc = await Announcement.findOne(query).sort({ startDate: -1, createdAt: -1 });

    if (!activeDoc) {
      // Find upcoming scheduled announcement for this audience if any, so client knows when to refresh
      const upcomingQuery = {
        status: 'scheduled',
        startDate: { $gt: now },
        cancelledAt: null,
      };
      if (!userRole) {
        upcomingQuery.targetAudience = 'all';
      } else if (userRole === 'admin') {
        upcomingQuery.targetAudience = { $in: ['all', 'admins'] };
      } else if (userRole === 'instructor') {
        upcomingQuery.targetAudience = { $in: ['all', 'instructors'] };
      } else if (userRole === 'student') {
        upcomingQuery.targetAudience = { $in: ['all', 'students'] };
      } else {
        upcomingQuery.targetAudience = 'all';
      }

      const nextScheduled = await Announcement.findOne(upcomingQuery).sort({ startDate: 1 });

      return {
        active: false,
        announcement: null,
        nextScheduledStart: nextScheduled ? nextScheduled.startDate : null,
        serverTime: now.toISOString(),
      };
    }

    return {
      active: true,
      announcement: {
        id: activeDoc._id.toString(),
        message: activeDoc.message,
        startDate: activeDoc.startDate,
        expiryDate: activeDoc.expiryDate,
        targetAudience: activeDoc.targetAudience,
      },
      serverTime: now.toISOString(),
    };
  }

  /**
   * Retrieve current announcement document and metadata for administrators
   */
  async getCurrentAnnouncement() {
    const now = new Date();
    // Retrieve the most recent announcement record
    const doc = await Announcement.findOne()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email role')
      .populate('updatedBy', 'name email role');

    if (!doc) {
      return {
        current: null,
        serverTime: now.toISOString(),
      };
    }

    const effectiveStatus = this.deriveEffectiveStatus(doc, now);

    return {
      current: {
        ...doc.toJSON(),
        effectiveStatus,
      },
      serverTime: now.toISOString(),
    };
  }

  /**
   * Retrieve announcement history for administrative oversight
   */
  async getAnnouncementHistory(limit = 20, page = 1) {
    const now = new Date();
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      Announcement.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email'),
      Announcement.countDocuments(),
    ]);

    const formatted = docs.map((doc) => ({
      ...doc.toJSON(),
      effectiveStatus: this.deriveEffectiveStatus(doc, now),
    }));

    return {
      announcements: formatted,
      total,
      page,
      limit,
      serverTime: now.toISOString(),
    };
  }

  /**
   * Save an announcement draft (not visible to users)
   */
  async saveDraft(data, user, ip = null) {
    const { id, message, targetAudience = 'all', durationDays = 0, durationHours = 1, durationMinutes = 0 } = data;

    let doc = null;
    if (id) {
      doc = await Announcement.findById(id);
    }

    if (doc) {
      doc.message = message.trim();
      doc.targetAudience = targetAudience;
      doc.durationDays = durationDays;
      doc.durationHours = durationHours;
      doc.durationMinutes = durationMinutes;
      doc.status = 'draft';
      doc.updatedBy = user._id;
      await doc.save();
    } else {
      doc = await Announcement.create({
        message: message.trim(),
        targetAudience,
        durationDays,
        durationHours,
        durationMinutes,
        status: 'draft',
        createdBy: user._id,
        updatedBy: user._id,
      });
    }

    // Record audit log
    await AuditLog.create({
      userId: user._id,
      action: 'ANNOUNCEMENT_DRAFT_SAVED',
      entityType: 'Announcement',
      entityId: doc._id.toString(),
      details: {
        message: doc.message,
        targetAudience: doc.targetAudience,
      },
      ipAddress: ip,
    });

    return doc;
  }

  /**
   * Publish an announcement immediately.
   * Supersedes any previously active or scheduled announcements.
   * Synchronizes SystemSetting.announcementBanner for backward compatibility.
   */
  async publishImmediate(data, user, ip = null) {
    const { id, message, targetAudience = 'all', durationDays = 0, durationHours = 0, durationMinutes = 0 } = data;
    const now = new Date();

    const totalMinutes = computeDurationMinutes(durationDays, durationHours, durationMinutes) || 60;
    const durationMs = totalMinutes * 60 * 1000;
    const expiryDate = new Date(now.getTime() + durationMs);

    const numDays = Number(durationDays) || 0;
    const numHours = Number(durationHours) || (totalMinutes === 60 && !numDays && !Number(durationMinutes) ? 1 : 0);
    const numMinutes = Number(durationMinutes) || 0;

    // Cancel any other currently active or scheduled announcements to enforce single global banner rule
    await Announcement.updateMany(
      {
        status: { $in: ['published', 'scheduled'] },
        expiryDate: { $gt: now },
        cancelledAt: null,
        ...(id ? { _id: { $ne: id } } : {}),
      },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          updatedBy: user._id,
        },
      }
    );

    let doc = null;
    if (id) {
      doc = await Announcement.findById(id);
    }

    if (doc) {
      doc.message = message.trim();
      doc.status = 'published';
      doc.startDate = now;
      doc.expiryDate = expiryDate;
      doc.durationDays = numDays;
      doc.durationHours = numHours;
      doc.durationMinutes = numMinutes;
      doc.targetAudience = targetAudience;
      doc.publishedAt = now;
      doc.cancelledAt = null;
      doc.updatedBy = user._id;
      await doc.save();
    } else {
      doc = await Announcement.create({
        message: message.trim(),
        status: 'published',
        startDate: now,
        expiryDate,
        durationDays: numDays,
        durationHours: numHours,
        durationMinutes: numMinutes,
        targetAudience,
        publishedAt: now,
        createdBy: user._id,
        updatedBy: user._id,
      });
    }

    // Mirror to SystemSetting for backward compatibility
    await SystemSetting.findOneAndUpdate(
      {},
      { announcementBanner: doc.message, updatedBy: user._id },
      { upsert: true, new: true }
    );

    // Record audit log
    await AuditLog.create({
      userId: user._id,
      action: 'ANNOUNCEMENT_PUBLISHED',
      entityType: 'Announcement',
      entityId: doc._id.toString(),
      details: {
        message: doc.message,
        startDate: doc.startDate,
        expiryDate: doc.expiryDate,
        totalMinutes,
        targetAudience: doc.targetAudience,
      },
      ipAddress: ip,
    });

    return doc;
  }

  /**
   * Schedule an announcement for future publication.
   */
  async scheduleAnnouncement(data, user, ip = null) {
    const { id, message, startDate, targetAudience = 'all', durationDays = 0, durationHours = 0, durationMinutes = 0 } = data;
    const now = new Date();

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      const err = new Error('Invalid scheduled start date');
      err.statusCode = 400;
      throw err;
    }

    const totalMinutes = computeDurationMinutes(durationDays, durationHours, durationMinutes) || 60;
    const durationMs = totalMinutes * 60 * 1000;
    const expiryDate = new Date(start.getTime() + durationMs);

    const numDays = Number(durationDays) || 0;
    const numHours = Number(durationHours) || (totalMinutes === 60 && !numDays && !Number(durationMinutes) ? 1 : 0);
    const numMinutes = Number(durationMinutes) || 0;

    // Cancel existing scheduled announcements to prevent conflicting schedules
    await Announcement.updateMany(
      {
        status: 'scheduled',
        startDate: { $gt: now },
        cancelledAt: null,
        ...(id ? { _id: { $ne: id } } : {}),
      },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: now,
          updatedBy: user._id,
        },
      }
    );

    let doc = null;
    if (id) {
      doc = await Announcement.findById(id);
    }

    if (doc) {
      doc.message = message.trim();
      doc.status = 'scheduled';
      doc.startDate = start;
      doc.expiryDate = expiryDate;
      doc.durationDays = numDays;
      doc.durationHours = numHours;
      doc.durationMinutes = numMinutes;
      doc.targetAudience = targetAudience;
      doc.publishedAt = null;
      doc.cancelledAt = null;
      doc.updatedBy = user._id;
      await doc.save();
    } else {
      doc = await Announcement.create({
        message: message.trim(),
        status: 'scheduled',
        startDate: start,
        expiryDate,
        durationDays: numDays,
        durationHours: numHours,
        durationMinutes: numMinutes,
        targetAudience,
        createdBy: user._id,
        updatedBy: user._id,
      });
    }

    // Record audit log
    await AuditLog.create({
      userId: user._id,
      action: 'ANNOUNCEMENT_SCHEDULED',
      entityType: 'Announcement',
      entityId: doc._id.toString(),
      details: {
        message: doc.message,
        startDate: doc.startDate,
        expiryDate: doc.expiryDate,
        totalMinutes,
        targetAudience: doc.targetAudience,
      },
      ipAddress: ip,
    });

    return doc;
  }

  /**
   * Cancel / unpublish an announcement immediately.
   * If no ID is specified, cancels any currently active or scheduled announcement.
   */
  async cancelAnnouncement(id = null, user, ip = null) {
    const now = new Date();

    let targetDoc = null;
    if (id) {
      targetDoc = await Announcement.findById(id);
    }

    if (targetDoc) {
      targetDoc.status = 'cancelled';
      targetDoc.cancelledAt = now;
      targetDoc.updatedBy = user._id;
      await targetDoc.save();
    } else {
      // Cancel any currently active or scheduled announcement
      const active = await Announcement.findOne({
        status: { $in: ['published', 'scheduled'] },
        cancelledAt: null,
      }).sort({ createdAt: -1 });

      if (active) {
        active.status = 'cancelled';
        active.cancelledAt = now;
        active.updatedBy = user._id;
        await active.save();
        targetDoc = active;
      }
    }

    // Clear SystemSetting.announcementBanner
    await SystemSetting.findOneAndUpdate(
      {},
      { announcementBanner: '', updatedBy: user._id }
    );

    // Record audit log
    if (targetDoc) {
      await AuditLog.create({
        userId: user._id,
        action: 'ANNOUNCEMENT_CANCELLED',
        entityType: 'Announcement',
        entityId: targetDoc._id.toString(),
        details: {
          cancelledAt: now,
          previousStatus: targetDoc.status,
        },
        ipAddress: ip,
      });
    }

    return targetDoc;
  }
}

// Export singleton instance
module.exports = new AnnouncementService();
