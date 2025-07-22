import React from 'react';

const CalendarMockup: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Calendar Area */}
        <div className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 bg-white border rounded">Today</button>
              <button className="px-2 py-1 bg-white border rounded">{'<'}</button>
              <span className="text-xl font-semibold">October 2020</span>
              <button className="px-2 py-1 bg-white border rounded">{'>'}</button>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-white border rounded">Week</button>
              <button className="px-3 py-1 bg-blue-700 text-white rounded">Month</button>
              <button className="px-3 py-1 bg-white border rounded">Agenda</button>
              <button className="px-3 py-1 bg-white border rounded text-xl">+</button>
            </div>
          </div>
          {/* Calendar Grid */}
          <div className="border rounded bg-white p-4">
            <table className="w-full text-center">
              <thead>
                <tr>
                  <th>Sun</th>
                  <th>Mon</th>
                  <th>Tue</th>
                  <th>Wed</th>
                  <th>Thu</th>
                  <th>Fri</th>
                  <th>Sat</th>
                </tr>
              </thead>
              <tbody>
                {/* Example: 5 weeks, static days */}
                <tr>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                </tr>
                <tr>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24">
                    <div className="bg-blue-100 text-blue-800 rounded px-2 py-1 text-xs mb-1">2p Faculty Meeting</div>
                  </td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24">
                    <div className="bg-green-100 text-green-800 rounded px-2 py-1 text-xs mb-1">8p Online Assignment</div>
                  </td>
                  <td className="h-24"></td>
                </tr>
                <tr>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                </tr>
                <tr>
                  <td className="h-24"></td>
                  <td className="h-24">
                    <div className="bg-green-100 text-green-800 rounded px-2 py-1 text-xs mb-1">Online Quiz</div>
                  </td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                </tr>
                <tr>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24">
                    <div className="bg-green-100 text-green-800 rounded px-2 py-1 text-xs mb-1">12p Office Hours</div>
                    <div className="bg-green-100 text-green-800 rounded px-2 py-1 text-xs mb-1">12:20p Office Hours</div>
                    <div className="bg-green-100 text-green-800 rounded px-2 py-1 text-xs">12:40p Office Hours</div>
                  </td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                  <td className="h-24"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-72 p-4">
          {/* Mini Month Picker */}
          <div className="bg-white border rounded p-2 mb-4">
            <div className="text-center font-semibold mb-2">October 2020</div>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th>
                </tr>
              </thead>
              <tbody>
                {/* Just a static example */}
                <tr>
                  <td className="text-gray-400">27</td>
                  <td className="text-gray-400">28</td>
                  <td className="text-gray-400">29</td>
                  <td>30</td>
                  <td>1</td>
                  <td>2</td>
                  <td>3</td>
                </tr>
                <tr>
                  <td>4</td><td>5</td><td>6</td><td>7</td><td>8</td><td>9</td><td>10</td>
                </tr>
                <tr>
                  <td>11</td><td>12</td><td>13</td><td>14</td><td>15</td><td>16</td><td>17</td>
                </tr>
                <tr>
                  <td>18</td><td>19</td><td>20</td><td>21</td><td>22</td><td>23</td><td>24</td>
                </tr>
                <tr>
                  <td>25</td><td>26</td><td>27</td><td>28</td><td>29</td><td>30</td><td>31</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Calendar List */}
          <div className="bg-white border rounded p-2">
            <div className="font-semibold mb-2">CALENDARS</div>
            <div className="flex items-center mb-1">
              <span className="w-3 h-3 rounded-full bg-blue-600 mr-2"></span>
              <span>Course A</span>
            </div>
            <div className="flex items-center mb-1">
              <span className="w-3 h-3 rounded-full bg-green-600 mr-2"></span>
              <span>Course B</span>
            </div>
            <div className="flex items-center mb-1">
              <span className="w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
              <span>Other</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarMockup; 