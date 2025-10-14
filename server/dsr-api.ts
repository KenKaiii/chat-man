/**
 * DSR (Data Subject Request) REST API Endpoints
 * Provides HTTP interface for GDPR data subject rights requests
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getDSRWorkflowManager, DSRType, DSRStatus } from './compliance/dsrWorkflow';
import { logger } from './utils/secureLogger';
import { logAuditEvent } from './audit/auditLogger';
import { AuditEventType } from './audit/auditEvents';

/**
 * POST /api/dsr/requests - Create new DSR request
 *
 * Request body:
 * {
 *   "type": "access" | "erasure" | "portability" | "rectification" | "restriction" | "objection" | "withdraw_consent",
 *   "requesterInfo": {
 *     "email": "user@example.com",
 *     "userId": "optional-user-id"
 *   },
 *   "requestDetails": {
 *     // Additional request-specific details
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "request": DSRRequest,
 *   "message": "DSR request created successfully"
 * }
 */
export async function handleCreateDSRRequest(req: Request): Promise<Response> {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.type) {
      logAuditEvent(AuditEventType.ERROR_VALIDATION, 'FAILURE', {
        action: 'create_dsr_request',
        error: 'Missing type field',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: type',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!body.requesterInfo) {
      logAuditEvent(AuditEventType.ERROR_VALIDATION, 'FAILURE', {
        action: 'create_dsr_request',
        error: 'Missing requesterInfo field',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: requesterInfo',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate DSR type
    const validTypes = Object.values(DSRType);
    if (!validTypes.includes(body.type)) {
      logAuditEvent(AuditEventType.ERROR_VALIDATION, 'FAILURE', {
        action: 'create_dsr_request',
        error: `Invalid type: ${body.type}`,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const manager = getDSRWorkflowManager();
    const request = manager.createRequest(
      body.type as DSRType,
      body.requesterInfo,
      body.requestDetails || {}
    );

    logger.info('DSR request created via API', {
      id: request.id.substring(0, 8) + '...',
      type: request.type,
    });

    return new Response(
      JSON.stringify({
        success: true,
        request,
        message: 'DSR request created successfully',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Failed to create DSR request', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    logAuditEvent(AuditEventType.ERROR_VALIDATION, 'FAILURE', {
      action: 'create_dsr_request',
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to create DSR request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET /api/dsr/requests - List all DSR requests
 *
 * Query parameters:
 * - status: Filter by status (pending, in_progress, completed, rejected)
 * - type: Filter by type (access, erasure, etc.)
 * - overdue: Filter for overdue requests (true/false)
 *
 * Response:
 * {
 *   "success": true,
 *   "requests": DSRRequest[],
 *   "count": number
 * }
 */
export async function handleListDSRRequests(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as DSRStatus | null;
    const type = url.searchParams.get('type') as DSRType | null;
    const overdue = url.searchParams.get('overdue') === 'true';

    const manager = getDSRWorkflowManager();
    const requests = manager.listRequests({
      status: status || undefined,
      type: type || undefined,
      overdue: overdue || undefined,
    });

    logAuditEvent(AuditEventType.DATA_ACCESS, 'SUCCESS', {
      action: 'list_dsr_requests',
      count: requests.length,
      filters: { status, type, overdue },
    });

    return new Response(
      JSON.stringify({
        success: true,
        requests,
        count: requests.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Failed to list DSR requests', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to list DSR requests',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET /api/dsr/requests/:id - Get specific DSR request
 *
 * Response:
 * {
 *   "success": true,
 *   "request": DSRRequest
 * }
 */
export async function handleGetDSRRequest(requestId: string): Promise<Response> {
  try {
    const manager = getDSRWorkflowManager();
    const request = manager.getRequest(requestId);

    if (!request) {
      logAuditEvent(AuditEventType.ERROR_NOT_FOUND, 'FAILURE', {
        action: 'get_dsr_request',
        requestId: requestId.substring(0, 8) + '...',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'DSR request not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    logAuditEvent(AuditEventType.DATA_ACCESS, 'SUCCESS', {
      action: 'get_dsr_request',
      requestId: requestId.substring(0, 8) + '...',
      type: request.type,
      status: request.status,
    });

    return new Response(
      JSON.stringify({
        success: true,
        request,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Failed to get DSR request', {
      requestId: requestId.substring(0, 8) + '...',
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to get DSR request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * PATCH /api/dsr/requests/:id - Update DSR request status
 *
 * Request body:
 * {
 *   "status": "pending" | "in_progress" | "completed" | "rejected",
 *   "notes": "Optional notes",
 *   "responseData": { ... } // Optional response data
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "DSR request updated successfully"
 * }
 */
export async function handleUpdateDSRRequest(requestId: string, req: Request): Promise<Response> {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.status) {
      logAuditEvent(AuditEventType.ERROR_VALIDATION, 'FAILURE', {
        action: 'update_dsr_request',
        requestId: requestId.substring(0, 8) + '...',
        error: 'Missing status field',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: status',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate status value
    const validStatuses = Object.values(DSRStatus);
    if (!validStatuses.includes(body.status)) {
      logAuditEvent(AuditEventType.ERROR_VALIDATION, 'FAILURE', {
        action: 'update_dsr_request',
        requestId: requestId.substring(0, 8) + '...',
        error: `Invalid status: ${body.status}`,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const manager = getDSRWorkflowManager();

    // Check if request exists
    const existingRequest = manager.getRequest(requestId);
    if (!existingRequest) {
      logAuditEvent(AuditEventType.ERROR_NOT_FOUND, 'FAILURE', {
        action: 'update_dsr_request',
        requestId: requestId.substring(0, 8) + '...',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'DSR request not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    manager.updateStatus(
      requestId,
      body.status as DSRStatus,
      body.notes,
      body.responseData
    );

    logger.info('DSR request updated via API', {
      id: requestId.substring(0, 8) + '...',
      newStatus: body.status,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'DSR request updated successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Failed to update DSR request', {
      requestId: requestId.substring(0, 8) + '...',
      error: error instanceof Error ? error.message : 'Unknown',
    });

    logAuditEvent(AuditEventType.ERROR_VALIDATION, 'FAILURE', {
      action: 'update_dsr_request',
      requestId: requestId.substring(0, 8) + '...',
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to update DSR request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * POST /api/dsr/requests/:id/process - Process a DSR request
 *
 * Automatically processes the request based on its type:
 * - access: Exports all user data
 * - erasure: Deletes all user data
 * - portability: Exports data in machine-readable format
 *
 * Response:
 * {
 *   "success": true,
 *   "result": Record<string, any>,
 *   "message": "DSR request processed successfully"
 * }
 */
export async function handleProcessDSRRequest(requestId: string): Promise<Response> {
  try {
    const manager = getDSRWorkflowManager();

    // Check if request exists
    const request = manager.getRequest(requestId);
    if (!request) {
      logAuditEvent(AuditEventType.ERROR_NOT_FOUND, 'FAILURE', {
        action: 'process_dsr_request',
        requestId: requestId.substring(0, 8) + '...',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'DSR request not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if already completed
    if (request.status === DSRStatus.COMPLETED) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'DSR request is already completed',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let result: Record<string, any>;

    // Process based on type
    switch (request.type) {
      case DSRType.ACCESS:
        result = await manager.processAccessRequest(requestId);
        break;
      case DSRType.ERASURE:
        result = await manager.processErasureRequest(requestId);
        break;
      case DSRType.PORTABILITY:
        result = await manager.processPortabilityRequest(requestId);
        break;
      default:
        // For other types, mark as in_progress but don't auto-process
        manager.updateStatus(
          requestId,
          DSRStatus.IN_PROGRESS,
          `Request type '${request.type}' requires manual processing`
        );

        return new Response(
          JSON.stringify({
            success: true,
            message: `DSR request marked as in_progress. Type '${request.type}' requires manual processing.`,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
    }

    logger.info('DSR request processed via API', {
      id: requestId.substring(0, 8) + '...',
      type: request.type,
    });

    return new Response(
      JSON.stringify({
        success: true,
        result,
        message: 'DSR request processed successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Failed to process DSR request', {
      requestId: requestId.substring(0, 8) + '...',
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process DSR request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET /api/dsr/statistics - Get DSR statistics
 *
 * Response:
 * {
 *   "success": true,
 *   "statistics": {
 *     "total": number,
 *     "byStatus": { ... },
 *     "byType": { ... },
 *     "overdue": number,
 *     "avgProcessingTimeHours": number
 *   }
 * }
 */
export async function handleGetDSRStatistics(): Promise<Response> {
  try {
    const manager = getDSRWorkflowManager();
    const statistics = manager.getStatistics();

    logAuditEvent(AuditEventType.DATA_ACCESS, 'SUCCESS', {
      action: 'get_dsr_statistics',
    });

    return new Response(
      JSON.stringify({
        success: true,
        statistics,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Failed to get DSR statistics', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to get DSR statistics',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
