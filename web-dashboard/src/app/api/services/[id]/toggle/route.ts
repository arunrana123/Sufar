import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5001';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log('Toggling service:', id);
    
    const response = await fetch(`${BACKEND_URL}/api/services/${id}/toggle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
    });
    
    const data = await response.json();
    
    console.log('Backend response:', { status: response.status, data });
    
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PATCH',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Service toggle API error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle service', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
